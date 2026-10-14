/**
 * Series: Threading — threads, shared state, and the data race.
 *
 * The thesis, as a picture: a thread is a *call running in its own frame* that
 * shares the module's heap. Unlike a coroutine (which only yields at `await`),
 * a thread is preempted after **every** statement, so two threads that touch the
 * same object interleave on that object. `join` is the scheduler that round-
 * robins the started threads one statement at a time; a `lock` serializes a
 * critical section so an interleaved read-modify-write can't lose an update.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';
import { schematicBlock, type SchematicSpec } from '../ui/schematic';

/**
 * The one picture the series is built on: two threads share ONE box. Preempted
 * statement by statement, both read box[0] before either writes — the second
 * write clobbers the first, and the counter ends at 1, not 2. The lost update
 * is the data race, seen in memory.
 */
const RACE_LOST_UPDATE: SchematicSpec = {
  id: 'threading-lost-update',
  title: 'A read-modify-write splits across two threads',
  nodes: [
    { id: 'box', label: 'box', sub: '[0] · shared', type: 'buffer' },
    { id: 't1', label: 'thread 1', sub: 'v = box[0]  →  v = 0' },
    { id: 't2', label: 'thread 2', sub: 'v = box[0]  →  v = 0' },
    { id: 'w1', label: 'thread 1', sub: 'box[0] = v + 1  →  [1]' },
    { id: 'w2', label: 'thread 2', sub: 'box[0] = v + 1  →  [1]  (clobbers!)' },
    { id: 'lost', label: 'box = [1]', sub: 'expected [2] — one update lost', type: 'note' },
  ],
  edges: [
    { from: 't1', to: 'box', label: 'reads 0', dashed: true },
    { from: 't2', to: 'box', label: 'reads 0', dashed: true },
    { from: 'w1', to: 'box', label: 'writes 1' },
    { from: 'w2', to: 'box', label: 'writes 1' },
    { from: 'w2', to: 'lost' },
  ],
  legend: [
    { color: 'coral', label: 'a thread reads the shared box' },
    { color: 'amber', label: 'a thread writes it back' },
    { color: 'muted', label: 'the lost-update result' },
  ],
};

/**
 * The fix as a picture: the lock is a gate. Only one thread may be inside the
 * critical section (acquire … release) at a time, so thread 2 waits until thread
 * 1 releases — the read-modify-write runs as a unit and box ends at 2.
 */
const LOCK_CRITICAL_SECTION: SchematicSpec = {
  id: 'threading-lock-critical-section',
  title: 'A lock makes the read-modify-write atomic',
  nodes: [
    { id: 'lk', label: 'lock', sub: 'a gate: one holder at a time', type: 'note' },
    { id: 't1a', label: 'thread 1', sub: 'acquire → reads 0 → writes 1' },
    { id: 't1b', label: 'thread 1', sub: 'release' },
    { id: 't2a', label: 'thread 2', sub: 'acquire (waits until release)' },
    { id: 't2b', label: 'thread 2', sub: 'reads 1 → writes 2' },
    { id: 'ok', label: 'box = [2]', sub: 'both updates land', type: 'note' },
  ],
  edges: [
    { from: 'lk', to: 't1a', label: 'held by t1' },
    { from: 't1a', to: 't1b' },
    { from: 't1b', to: 't2a', label: 'frees the gate' },
    { from: 'lk', to: 't2a', label: 'now held by t2' },
    { from: 't2a', to: 't2b' },
    { from: 't2b', to: 'ok' },
  ],
  legend: [
    { color: 'amber', label: 'a thread holds the lock inside its critical section' },
    { color: 'muted', label: 'the gate and the safe result' },
  ],
};

export const series: Sequence[] = [
  {
    id: 'threading',
    title: 'Threading: Threads, Shared State & the Data Race',
    deepLesson: `## ELI5

Imagine **two kids and one jar of candy**. Each kid's job is "look at how many
pieces are in the jar, take the number, then write the number plus one on the
jar." If the first kid looks (0), and *before* he writes, the second kid also
looks (0), then both of them write "1". The jar says **1** — even though two
kids added candy. One kid's count got **erased**. That's the whole idea: two
people on one shared thing, stepping on each other. A **lock** is a little
sign that says "only one person may touch the jar at a time" — the second kid
has to wait outside until the first puts the sign back.

${schematicBlock(RACE_LOST_UPDATE)}

## ELI10

A **thread** is a *call running in its own place* that still uses the **same
memory** as everyone else. A **threading.Thread(target, args)** object does not
run yet — it is a not-started call (like a coroutine object, but for threads).

- \`t.Thread(bump, (box,))\` builds a thread that will run \`bump(box)\`.
- \`w.start()\` marks it running. It actually runs **inside \`w.join()\`**.
- \`w.join()\` is the **scheduler**: it steps the started threads one
  **statement** at a time, round-robin, until they finish.
- Because it steps one statement at a time, two threads that read and write the
  **same object** can interleave on it.

There are no real OS threads or CPU cores here — the *preemption* is simulated,
and the interleaving shows up in what the shared object ends up holding.

## ELI15

The mental model: **threads share the heap, and they are preempted after every
statement.** That preemption is the whole story.

- A plain assignment like \`box[0] = box[0] + 1\` looks atomic, but a real
  read-modify-write is really *read, then compute, then write* — three steps.
  When a thread can be interrupted between the read and the write, the other
  thread reads the **stale** value.
- So to make the race visible, the increment is split into two statements —
  \`v = box[0]\` then \`box[0] = v + 1\` — exactly the read-then-write a
  scheduler can slip between.
- The standing question: *which threads can interleave on this object, and does
  the order of their reads and writes lose information?*
- A **lock** answers it: \`lk.acquire()\` / \`lk.release()\` wrap a critical
  section so only one thread is inside at a time.

## ELI20

The mechanics, precisely.

- A thread stores \`{target, name, status, pc, locals, returnValue}\`. \`pc\` is
  the program counter; \`locals\` are its frame's saved variables; \`status\`
  moves **not-started → running ⇄ blocked → done**.
- \`threadJoin\` round-robins every started thread. Each turn it pushes the
  thread's saved locals onto the frame stack and runs **exactly one statement**
  (\`stepThread\`), then saves locals back and preempts. One statement per turn
  is what forces the interleaving.
- \`lockAcquire\` on a free lock (or one held by *this* thread) takes it. Held by
  *another* thread, it **suspends** the caller (\`status\` → blocked, \`pc\` left
  on the \`acquire()\`) and retries next round — so it blocks until the holder
  calls \`release()\`. Unlike a one-shot \`await\`, an \`acquire\` that blocks does
  **not** advance past itself; it re-runs until granted.
- A full round with no real progress is a **deadlock** (circular lock wait);
  the scheduler detects it and stops rather than hang.

${schematicBlock(LOCK_CRITICAL_SECTION)}

## ELI-PHD

Where it pays off and where this model stops.

- **Real threads** run on real CPU cores with a real OS scheduler: non-deterministic
  context switches, the GIL, cache coherence, and true preemption at any
  instruction boundary. This visualizer simulates the *schedule* (one statement
  per round) so the interleaving is **deterministic and reproducible** — a teaching
  property, not a property of real Python.
- **\`join\` is your scheduler.** In real Python the OS interleaves threads; here
  \`join\` does the round-robin so you can *see* a specific interleaving. That is
  why the lesson is deterministic: the race isn't "sometimes", it's "always, here,
  in this order" — which is what makes it teachable.
- **The data race is real, the fix is real.** A lost update on shared mutable
  state under concurrent read-modify-write is the most common concurrency bug.
  A lock (or an atomic, or a queue) makes the critical section atomic. Everything
  this series shows — shared box, interleaved read-modify-write, lock serializing
  it — transfers directly to real threads, asyncio-with-shared-state, and database
  transactions alike.
- **\`lock.acquire()\` returning a value:** real \`Lock.acquire(blocking=True)\`
  blocks; here it suspends the thread and retries, which is the same *effect*
  made visible. A **re-entrant** lock (held by the same thread) is taken again
  freely, matching a real RLock's self-reentry.
`,
    levels: [
      {
        id: 'th-make-thread',
        eli: 'eli10',
        name: 'Build a thread',
        brief: 'Define `bump(box)` and build `w = t.Thread(bump, (box,))`. A **thread** object does not run yet — it is a not-started call that shares the module memory.',
        hint: 'w = t.Thread(bump, (box,))',
        start: 'import threading as t\nbox = [0]\ndef bump(box):\n    v = box[0]\n    box[0] = v + 1',
        par: 1,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.isThread('w'), preds.threadStatus('w', 'not-started')],
        },
        solution: 'w = t.Thread(bump, (box,))',
        lesson: `A **thread** is a call that runs in its own frame but shares the module's memory. \`t.Thread(bump, (box,))\` does **not** run \`bump\` — it builds a *not-started* thread that *will* run \`bump(box)\`. The target function and the shared \`box\` are captured; nothing has executed yet, so \`box\` is still \`[0]\`. Like a coroutine object, a thread is a saved call you can pass around and start later.`,
        learning: ['A Thread object is a not-started call — the target has not run yet', 'Threads share the module heap — the box they touch is the same object'],
        fieldNotes: ['`t.Thread(target, args)` is positional here (no keyword args in the subset)', 'A thread object is reusable: start it, then join it to run it'],
      },
      {
        id: 'th-start-join',
        eli: 'eli15',
        name: 'Start and join one thread',
        brief: 'Build the thread, then `w.start()` and `w.join()`. The join is the **scheduler** — it runs the thread to completion, and the shared `box` changes from `[0]` to `[1]`.',
        hint: 'w.start()\nw.join()',
        start: 'import threading as t\nbox = [0]\ndef bump(box):\n    v = box[0]\n    box[0] = v + 1\nw = t.Thread(bump, (box,))',
        par: 2,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.threadStatus('w', 'done'), preds.listValueAt('box', 0, 1)],
        },
        solution: 'w.start()\nw.join()',
        lesson: `\`start()\` marks the thread running; it actually executes inside \`w.join()\`. The **join is the scheduler**: it steps the thread statement by statement until it finishes. \`bump\` reads \`box[0]\` (0), then writes \`v + 1\` back — so the shared box goes \`[0] → [1]\`. One thread, one clean read-modify-write, one increment. There is no race yet because only one thread is touching the box.`,
        learning: ['join() is the scheduler that actually runs a started thread', 'A single thread does its read-modify-write atomically — no race with only one'],
        fieldNotes: ['In real Python the OS runs the thread; here join round-robins it so you can watch', 'The thread mutated the shared box in place — the module sees [1]'],
      },
      {
        id: 'th-race',
        eli: 'eli20',
        name: 'Two threads, one box: the lost update',
        brief: 'Run **two** threads that each bump the same `box`, with no lock. Preempted statement-by-statement, both read `box[0]=0` before either writes — so `box` ends at **1, not 2**. That lost update is the data race.',
        hint: 't1.start()\nt2.start()\nt1.join()',
        start: 'import threading as t\nbox = [0]\ndef bump(box):\n    v = box[0]\n    box[0] = v + 1\nt1 = t.Thread(bump, (box,))\nt2 = t.Thread(bump, (box,))',
        par: 3,
        difficulty: 4,
        goal: {
          type: 'predicates',
          predicates: [
            preds.threadStatus('t1', 'done'),
            preds.threadStatus('t2', 'done'),
            preds.listValueAt('box', 0, 1),
          ],
        },
        solution: 't1.start()\nt2.start()\nt1.join()',
        lesson: `This is the whole lesson. \`join\` round-robins the two threads **one statement at a time**: thread 1 reads \`box[0]\` into \`v\` (→ 0); then thread 2 reads \`box[0]\` into *its* \`v\` (→ 0, the box is still 0); then thread 1 writes \`v + 1\` (box → 1); then thread 2 writes *its* \`v + 1\` (box → 1). Both threads read the **same stale 0**, so the second write clobbers the first — the box ends at **1**, not 2. That is a **data race**: a read-modify-write interleaved so an update is lost. The bug is not in either thread; it is in *sharing* the box without coordinating.`,
        learning: ['Two threads on one object interleave statement-by-statement', 'A read-modify-write split across the interleaving loses an update (the box ends at 1, not 2)'],
        fieldNotes: ['Real CPython threads hit this same race — the GIL does NOT make `x = x + 1` on shared state safe', 'The race is *nondeterministic* on real CPUs; here join makes one interleaving deterministic so it is teachable'],
      },
      {
        id: 'th-lock',
        eli: 'eliphd',
        name: 'Fix the race with a lock',
        brief: 'Give each thread a shared `lk = t.Lock()` and wrap the read-modify-write in `lk.acquire()` / `lk.release()`. Now only one thread is inside at a time — the box ends at **2**. The race is gone.',
        hint: 't1.start()\nt2.start()\nt1.join()',
        start: 'import threading as t\nbox = [0]\ndef bump(box, lk):\n    lk.acquire()\n    v = box[0]\n    box[0] = v + 1\n    lk.release()\nlk = t.Lock()\nt1 = t.Thread(bump, (box, lk))\nt2 = t.Thread(bump, (box, lk))',
        par: 3,
        difficulty: 5,
        goal: {
          type: 'predicates',
          predicates: [
            preds.threadStatus('t1', 'done'),
            preds.threadStatus('t2', 'done'),
            preds.listValueAt('box', 0, 2),
            preds.lockFree('lk'),
          ],
        },
        solution: 't1.start()\nt2.start()\nt1.join()',
        lesson: `The fix. \`lk.acquire()\` is the gate: thread 1 acquires it and does its whole read-modify-write (0 → 1) **before** it releases. When thread 2 tries to acquire, the lock is **held**, so it *blocks* (suspends) and retries next round — it only enters once thread 1 has released. Inside the critical section it now reads the **updated** box (1) and writes 2. Mutual exclusion made the read-modify-write **atomic** with respect to the other thread, so both increments land: box ends at **2**, and the lock is free again. The data race is gone because the shared state is only ever touched by one thread at a time.`,
        learning: ['A lock makes a critical section atomic — only one thread inside at a time', 'acquire() on a held lock blocks the caller until the holder release()s', 'The lock fixes the lost update: box ends at 2, not 1'],
        fieldNotes: ['Wrap the *smallest* possible critical section — holding a lock too long serializes threads that need not be', 'A re-entrant lock (a real RLock) lets the same thread re-acquire; here a self-held lock is taken freely'],
      },
      {
        id: 'th-critical-capstone',
        eli: 'eliphd',
        name: 'Capstone: block, wait, and proceed in order',
        brief: 'Two threads, one lock: `hold` takes the lock, prints, releases; `wait_then` tries to take it and **blocks** until `hold` releases, then proceeds. The output order proves the lock ordered them: `A holds` before `B proceeds`.',
        hint: 'ta.start()\ntb.start()\nta.join()',
        start: 'import threading as t\ndef hold(lk):\n    lk.acquire()\n    print("A holds")\n    lk.release()\ndef wait_then(lk):\n    lk.acquire()\n    print("B proceeds")\n    lk.release()\nlk = t.Lock()\nta = t.Thread(hold, (lk,))\ntb = t.Thread(wait_then, (lk,))',
        par: 3,
        difficulty: 5,
        goal: {
          type: 'predicates',
          predicates: [
            preds.threadStatus('ta', 'done'),
            preds.threadStatus('tb', 'done'),
            preds.lockFree('lk'),
          ],
        },
        solution: 'ta.start()\ntb.start()\nta.join()',
        lesson: `The capstone: **mutual exclusion as ordering**. \`ta\` (\`hold\`) acquires the lock first, prints "A holds", and releases. \`tb\` (\`wait_then\`) tries to acquire but the lock is **held** — so it blocks, suspending on the \`acquire()\` without advancing. When \`ta\` releases, \`tb\` is retried, acquires, and *then* prints "B proceeds". Watch the memory canvas: while \`tb\` is blocked, its thread box reads **blocked** (coral) and the lock box reads **HELD** by \`ta\`. The output — "A holds" then "B proceeds" — is the proof the lock *ordered* two independent threads on shared state. That is exactly what a lock buys you: not just correctness, but a **deterministic order** over a critical section.`,
        learning: ['acquire() on a held lock blocks the caller (status → blocked) until release', 'Mutual exclusion gives you ordering, not just safety — B can only run after A releases', 'A blocked thread is a visible state, not a mystery — the canvas shows it'],
        fieldNotes: ['This is how every mutex-protected critical section behaves — the output order is the contract', 'Deadlock is the failure mode of locks: if A waited on a lock B held and B waited on a lock A held, neither would ever release'],
      },
    ],
  },
];
