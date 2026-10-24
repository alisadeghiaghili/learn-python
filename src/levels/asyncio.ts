/**
 * Series: Asyncio — coroutines, tasks, and the event loop.
 *
 * The thesis, as a picture: a coroutine is a *suspended function*, a task is a
 * named handle to one, and the event loop round-robins ready tasks — one tick
 * at a time — so two pieces of work visibly interleave instead of running one
 * after the other. There is no real event loop or wall clock here (the fidelity
 * boundary): the *schedule* is simulated, and the interleaving shows up in the
 * round-robined output and the loop's tick count.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';
import { schematicBlock, type SchematicSpec } from '../ui/schematic';

/**
 * The one picture the series is built on: the event loop is a queue. It steps
 * task A to its next `await` (A suspends), then moves to task B, then back —
 * one task per tick, until every task is done.
 */
const ASYNC_LOOP_TICK: SchematicSpec = {
  id: 'asyncio-event-loop-tick',
  title: 'The event loop hands the tick task by task',
  nodes: [
    { id: 'loop', label: 'EventLoop', sub: 'a queue of ready tasks', type: 'note' },
    { id: 'a1', label: 'task A', sub: 'run to its await · tick 1' },
    { id: 'b1', label: 'task B', sub: 'run to its await · tick 2' },
    { id: 'a2', label: 'task A', sub: 'resumes after the await · tick 3' },
    { id: 'done', label: 'all tasks done', sub: 'the loop stops', type: 'note' },
  ],
  edges: [
    { from: 'loop', to: 'a1', label: 'step' },
    { from: 'a1', to: 'b1', label: 'A suspends' },
    { from: 'b1', to: 'a2', label: 'B suspends' },
    { from: 'a2', to: 'done', label: 'A finishes' },
  ],
  legend: [
    { color: 'amber', label: 'a tick advances one task' },
    { color: 'muted', label: 'the loop and the finish' },
  ],
};

/**
 * A task's lifecycle: a not-yet-started coroutine becomes ready on the loop,
 * suspends on each `await`, and ends done.
 */
const ASYNC_TASK_STATES: SchematicSpec = {
  id: 'asyncio-task-states',
  title: 'A task\'s states across the loop',
  nodes: [
    { id: 'pending', label: 'pending', sub: 'a fresh coroutine' },
    { id: 'ready', label: 'ready', sub: 'queued on the loop' },
    { id: 'suspended', label: 'suspended', sub: 'waiting at an await' },
    { id: 'done', label: 'done', sub: 'returned' },
  ],
  edges: [
    { from: 'pending', to: 'ready', label: 'create_task' },
    { from: 'ready', to: 'suspended', label: 'await' },
    { from: 'suspended', to: 'ready', label: 'loop resumes it' },
    { from: 'ready', to: 'done', label: 'returns' },
  ],
  legend: [
    { color: 'amber', label: 'moving on the loop' },
    { color: 'coral', label: 'suspended at an await' },
    { color: 'teal', label: 'settled' },
  ],
};

export const series: Sequence[] = [
  {
    id: 'asyncio',
    title: 'Asyncio: Coroutines, Tasks & the Event Loop',
    deepLesson: `## Beginner

Think of **two people and one stove**. Each person has a recipe that says
"cook a bit, then wait for the water to boil, then cook a bit more." Nobody
stands around *staring* at the pot. When a person says "waiting," they step
away, and the **stove's owner** (the **event loop**) lets the *other* person
cook a bit. "Waiting" never blocks the kitchen — it just frees the stove so the
next person can use it. That is all asyncio is: people (coroutines) who step
away at \`await\` so the stove (the loop) can serve everyone fairly.

${schematicBlock(ASYNC_LOOP_TICK)}

## Intermediate

A **coroutine** is an object that holds a function's *saved place*. Calling an
\`async def\` does **not** run the body — it hands you a coroutine (a bookmark on
page 0 of that function). A **task** is a *named handle* to a coroutine, and the
**event loop** is a queue of ready tasks.

- \`async def\` makes a coroutine-function; **calling** it returns a coroutine.
- \`a.create_task(coro)\` wraps a coroutine in a task.
- \`await\` is a **suspension**: the task sets its bookmark and yields, so the
  loop can run someone else.
- \`a.run(t1, t2, ...)\` starts the loop: it steps each ready task to its next
  \`await\`, then moves on, until they're all done.

Nothing blocks. A suspended task is just an object sitting on the loop's queue.

## Advanced

The mental model: **the loop is a round-robin queue of ready tasks, and \`await\`
is where a task gets back on the queue.** That is the entire asyncio picture.

- One task at a time runs, to its next \`await\` or return. That is a **tick**.
- The tasks interleave: A, B, A, B… — you can *see* it in the round-robined
  output (each task prints its own line between the other's).
- \`await a.sleep(0.1)\` is how a task waits *without blocking* — it yields the
  tick, so the other tasks keep going while it "waits."
- So the standing question: *when does this task yield, and who runs in the gap?*
  Every \`await\` is a gap the loop can fill.

## Expert

The mechanics, precisely.

- A coroutine stores \`{status, pc, locals}\`. \`pc\` is the instruction pointer;
  \`locals\` is the frame's saved variables. A tick runs statements from \`pc\`
  until a cooperative \`await\` (save locals, resume at the next tick) or a
  \`return\` (record the result, mark done).
- A task is \`{coro, name, status}\` with a lifecycle: **pending → ready →
  suspended ⇄ ready → done** (see the states picture below). \`create_task\`
  promotes a pending coroutine to ready.
- The loop is \`{ready, done, tick}\`. Each tick pops the next ready task, steps
  its coroutine once, then re-queues it (ready) or moves it to done. \`tick\`
  counts how many times the loop handed the stove to a task.

${schematicBlock(ASYNC_TASK_STATES)}

## Master

Where it pays off and where this model stops.

- **Real asyncio** runs on a *real* event loop with a real event model:
  wall-clock time, file/network I/O, threads, and \`async for\`/\`async with\`.
  This visualizer simulates only the *schedule* — the tick-based round-robin —
  because that is the mental model; it does not simulate real time or real I/O.
- **\`await\` on anything is a yield.** Awaiting a sleep, a future, or an I/O call
  all do the same thing: hand the tick back. The difference is *when* they resume.
- **One thread, many coroutines.** Concurrency here is *cooperative*: no task
  runs unless another one yields. That is why one runaway \`await\`-free task can
  starve the loop — exactly the lesson the tick model makes visible.
- **\`gather\`** runs a group of tasks and collects their results; **locks** and
  queues add ordering when tasks must coordinate on shared data (this series keeps
  to shared lists so the interleaving stays legible).
`,
    levels: [
      {
        id: 'as-make-coro',
        eli: 'eli10',
        name: 'Call an async def',
        brief: 'Define `async def greet():` and call `c = greet()`. Calling it does NOT run the body — it returns a **coroutine**, a saved place in the function.',
        hint: 'c = greet()',
        start: 'import asyncio as a\nasync def greet():\n    print("hi")\n    await a.sleep(0)',
        par: 1,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.isCoroutine('c')],
        },
        solution: 'c = greet()',
        lesson: `An **async def** is a coroutine function. Calling it does **not** run the body — it returns a **coroutine** object, a saved place (at statement 0) in that function. Nothing has run: no output, no progress. The body runs later, when something drives the coroutine on ticks.`,
        learning: ['Calling an async def returns a coroutine, not a result', 'The body has not run yet — the coroutine is a saved place'],
        fieldNotes: ['A coroutine is an object you can pass around (as an argument to create_task)', '`await a.sleep(0)` is a suspension point the loop will hit later'],
      },
      {
        id: 'as-create-task',
        eli: 'eli15',
        name: 'Wrap a coroutine in a task',
        brief: 'Build `c = greet()` (a coroutine) and `t = a.create_task(c)`. A **task** is a *named handle* to a coroutine — the unit the event loop schedules.',
        hint: 't = a.create_task(c)',
        start: 'import asyncio as a\nasync def greet():\n    print("hi")\n    await a.sleep(0)\nc = greet()',
        par: 1,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.isTask('t'), preds.isCoroutine('c')],
        },
        solution: 't = a.create_task(c)',
        lesson: `A **task** is a *named handle* to a coroutine — the thing the event loop actually schedules. \`create_task(c)\` wraps the coroutine \`c\` in a task that starts in the **ready** state, queued and waiting for the loop to run it. The task and the coroutine are two objects: the task *points at* the coroutine.`,
        learning: ['A task is a named handle to a coroutine', 'create_task puts the coroutine into the ready state, queued on the loop'],
        fieldNotes: ['`create_task` returns a Task — the loop and `gather` both take tasks', 'One coroutine can be wrapped in a task only once in real asyncio'],
      },
      {
        id: 'as-run-one',
        eli: 'eli15',
        name: 'Run the loop (one task)',
        brief: 'Create a task `t = a.create_task(greet())` and start the loop with `a.run(t)`. The loop steps the task to completion — its `print` appears.',
        hint: 'a.run(t)',
        start: 'import asyncio as a\nasync def greet():\n    print("hi")\n    await a.sleep(0)\nt = a.create_task(greet())',
        par: 1,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.taskStatus('t', 'done'), preds.loopRan(1)],
        },
        solution: 'a.run(t)',
        lesson: `\`a.run(t)\` starts the **event loop**. It pops the task, steps its coroutine to the next \`await\` (printing "hi"), the task suspends, and on the following tick it resumes after the \`await\` and returns — **done**. One task, a couple of ticks, and the loop stops because the queue is empty.`,
        learning: ['a.run starts the loop and drives tasks until they are all done', 'Each tick steps the current task to its next await or return'],
        fieldNotes: ['`a.run` returns when every task is done', 'The loop is the scheduler — without it, a task never runs'],
      },
      {
        id: 'as-await-yields',
        eli: 'eli20',
        name: 'await yields the tick',
        brief: 'Two tasks, `a.run(t1, t2)`. Task 1 prints, then `await`s — it **suspends**, and the loop hands the tick to task 2 before coming back. Watch the output interleave.',
        hint: 'a.run(t1, t2)',
        start: 'import asyncio as a\nasync def first():\n    print("1a")\n    await a.sleep(0)\n    print("1b")\nasync def second():\n    print("2")\nt1 = a.create_task(first())\nt2 = a.create_task(second())',
        par: 1,
        difficulty: 4,
        goal: {
          type: 'predicates',
          predicates: [
            preds.taskStatus('t1', 'done'),
            preds.taskStatus('t2', 'done'),
            preds.loopRan(2),
            preds.differentTasks('t1', 't2'),
          ],
        },
        solution: 'a.run(t1, t2)',
        lesson: `This is the whole lesson made visible. \`first()\` prints "1a", hits \`await\`, and **suspends** — the loop doesn't wait, it moves to the *next* ready task. \`second()\` prints "2" and returns. Only then does the loop come back to \`first()\`, which prints "1b" and finishes. The output \`1a, 2, 1b\` is the proof: **\`await\` never blocks — it yields the tick so someone else runs.**`,
        learning: ['await suspends the current task and lets the loop run the next ready task', 'Two tasks interleave (A, B, A) instead of running one after the other'],
        fieldNotes: ['The output order — not the code order — is what concurrency looks like', '`await a.sleep(0)` is the minimal yield; real code awaits sleep / I/O / futures'],
      },
      {
        id: 'as-produce-consume',
        eli: 'eliphd',
        name: 'Capstone: producer & consumer',
        brief: 'Two cooperating tasks over a **shared list**: `producer` appends, `consumer` reads, each yielding on `await`. Run them both — they interleave and the consumer sees what the producer wrote.',
        hint: 'a.run(tp, tc)',
        start: 'import asyncio as a\nitems = []\nasync def producer():\n    items.append("p1")\n    await a.sleep(0)\n    items.append("p2")\nasync def consumer():\n    await a.sleep(0)\n    print(items[0])\ntp = a.create_task(producer())\ntc = a.create_task(consumer())',
        par: 1,
        difficulty: 5,
        goal: {
          type: 'predicates',
          predicates: [
            preds.taskStatus('tp', 'done'),
            preds.taskStatus('tc', 'done'),
            preds.loopRan(2),
            preds.differentTasks('tp', 'tc'),
            preds.listLen('items', 2),
          ],
        },
        solution: 'a.run(tp, tc)',
        lesson: `The capstone. Two tasks **cooperate through a shared list**. \`producer\` appends "p1", yields at \`await\`; the loop runs \`consumer\`, which yields (so it runs *after* the producer's first write) and prints "p1". Back to \`producer\`, which appends "p2" and finishes. The consumer **saw** the producer's write because both tasks share the same list object — and \`await\` ordered them. That coordination-via-yield is the essence of async: **tasks don't block, they hand the loop back, and the shared state is what they exchange.**`,
        learning: ['Tasks coordinate by sharing state and yielding in the right order', 'await orders who sees whose write — the consumer reads after the producer writes'],
        fieldNotes: ['Real asyncio uses queues/locks to order producers and consumers explicitly', 'This model keeps the shared-state picture — the part a memory lens teaches best'],
      },
    ],
  },
];
