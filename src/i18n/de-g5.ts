import type { LevelGroup } from './types';

export const deG5: LevelGroup = {
  seriesTitles: {
    asyncio: 'Asyncio: Coroutinen, Tasks und der Event-Loop',
    threading: 'Threading: Threads, gemeinsamer Zustand und das Data Race',
  },
  deepLessons: {
    asyncio: `## Beginner

Stell dir **zwei Personen und einen einzigen Herd** vor. Jede Person hat ein
Rezept, das sagt: „Koch ein wenig, warte, bis das Wasser kocht, und koch dann
wieder ein wenig weiter." Niemand steht da und *starrt* in den Topf. Wenn eine
Person sagt „ich warte", tritt sie beiseite, und der **Herd-Besitzer** (der
**Event-Loop**) lässt die *andere* Person ein Stück weiterkochen. „Warten" blockiert
die Küche nie — es gibt den Herd einfach frei, damit die nächste Person ihn
benutzen kann. Das ist alles, was Asyncio ist: Menschen (Coroutinen), die bei
\`await\` beiseite treten, damit der Herd (der Loop) alle fair bedienen kann.

\`\`\`schematic
{
  "id": "asyncio-event-loop-tick",
  "title": "The event loop hands the tick task by task",
  "nodes": [
    {
      "id": "loop",
      "label": "EventLoop",
      "sub": "a queue of ready tasks",
      "type": "note"
    },
    {
      "id": "a1",
      "label": "task A",
      "sub": "run to its await · tick 1"
    },
    {
      "id": "b1",
      "label": "task B",
      "sub": "run to its await · tick 2"
    },
    {
      "id": "a2",
      "label": "task A",
      "sub": "resumes after the await · tick 3"
    },
    {
      "id": "done",
      "label": "all tasks done",
      "sub": "the loop stops",
      "type": "note"
    }
  ],
  "edges": [
    {
      "from": "loop",
      "to": "a1",
      "label": "step"
    },
    {
      "from": "a1",
      "to": "b1",
      "label": "A suspends"
    },
    {
      "from": "b1",
      "to": "a2",
      "label": "B suspends"
    },
    {
      "from": "a2",
      "to": "done",
      "label": "A finishes"
    }
  ],
  "legend": [
    {
      "color": "amber",
      "label": "a tick advances one task"
    },
    {
      "color": "muted",
      "label": "the loop and the finish"
    }
  ]
}
\`\`\`

## Intermediate

Eine **Coroutine** ist ein Objekt, das einen *gespeicherten Ort* einer Funktion
hält. Den Aufruf einer \`async def\` **führt** den Funktionskörper **nicht** aus —
er übergibt dir eine Coroutine (ein Lesezeichen auf Seite 0 dieser Funktion). Ein
**Task** ist ein *benannter Handle* auf eine Coroutine, und der **Event-Loop**
ist eine Warteschlange aus fertigen (ready) Tasks.

- \`async def\` erstellt eine Coroutine-Funktion; der **Aufruf** davon liefert eine
  Coroutine zurück.
- \`a.create_task(coro)\` verpackt eine Coroutine in einen Task.
- \`await\` ist eine **Suspendierung**: Der Task setzt sein Lesezeichen und
  übergibt die Kontrolle (yield), damit der Loop jemand anderes ausführen kann.
- \`a.run(t1, t2, ...)\` startet den Loop: Er führt jeden fertigen Task bis zu
  seinem nächsten \`await\` aus, geht dann weiter und wiederholt das, bis alle
  erledigt sind.

Nichts blockiert. Ein suspendierter Task ist einfach ein Objekt, das auf der
Warteschlange des Loops liegt.

## Advanced

Das mentale Modell: **Der Loop ist eine Round-Robin-Warteschlange aus fertigen
Tasks, und \`await\` ist der Ort, an dem ein Task wieder in die Warteschlange
zurückkehrt.** Das ist das gesamte Asyncio-Bild.

- Immer nur ein Task läuft, bis zu seinem nächsten \`await\` oder \`return\`. Das
  ist ein **Tick**.
- Die Tasks überlagern sich: A, B, A, B … — du kannst es im Round-Robin-Output
  *sehen* (jeder Task druckt seine eigene Zeile zwischen den Zeilen des anderen).
- \`await a.sleep(0.1)\` ist die Art, wie ein Task wartet, *ohne zu blockieren* —
  er gibt den Tick heraus, damit die anderen Tasks weiterlaufen können, während
  er „wartet".
- Die ständige Frage lautet also: *Wann übergibt dieser Task die Kontrolle, und
  wer läuft in der Lücke?* Jedes \`await\` ist eine Lücke, die der Loop füllen
  kann.

## Expert

Die Mechanik, präzise.

- Eine Coroutine speichert \`{status, pc, locals}\`. \`pc\` ist der
  Instruktionszeiger; \`locals\` sind die gespeicherten Variablen des Frames. Ein
  Tick führt Anweisungen ab \`pc\` aus, bis ein kooperatives \`await\` kommt
  (Locals speichern, beim nächsten Tick fortsetzen) oder ein \`return\` (Ergebnis
  festhalten, als erledigt markieren).
- Ein Task ist \`{coro, name, status}\` mit einem Lebenszyklus: **pending →
  ready → suspended ⇄ ready → done** (siehe das Zustands-Bild unten).
  \`create_task\` hebt eine pending Coroutine in den ready-Zustand hoch.
- Der Loop ist \`{ready, done, tick}\`. Jeder Tick nimmt den nächsten fertigen
  Task heraus, führt dessen Coroutine einmal weiter und stellt ihn dann wieder
  in die Warteschlange (ready) oder verschiebt ihn nach done. \`tick\` zählt, wie
  oft der Loop den Herd an einen Task weitergegeben hat.

\`\`\`schematic
{
  "id": "asyncio-task-states",
  "title": "A task's states across the loop",
  "nodes": [
    {
      "id": "pending",
      "label": "pending",
      "sub": "a fresh coroutine"
    },
    {
      "id": "ready",
      "label": "ready",
      "sub": "queued on the loop"
    },
    {
      "id": "suspended",
      "label": "suspended",
      "sub": "waiting at an await"
    },
    {
      "id": "done",
      "label": "done",
      "sub": "returned"
    }
  ],
  "edges": [
    {
      "from": "pending",
      "to": "ready",
      "label": "create_task"
    },
    {
      "from": "ready",
      "to": "suspended",
      "label": "await"
    },
    {
      "from": "suspended",
      "to": "ready",
      "label": "loop resumes it"
    },
    {
      "from": "ready",
      "to": "done",
      "label": "returns"
    }
  ],
  "legend": [
    {
      "color": "amber",
      "label": "moving on the loop"
    },
    {
      "color": "coral",
      "label": "suspended at an await"
    },
    {
      "color": "teal",
      "label": "settled"
    }
  ]
}
\`\`\`

## Master

Wo es sich auszahlt und wo dieses Modell endet.

- **Echtes Asyncio** läuft auf einer *echten* Event-Loop mit einem echten
  Ereignis-Modell: Echtzeit (Wall-Clock), Datei-/Netzwerk-I/O, Threads und
  \`async for\`/\`async with\`. Dieser Visualizer simuliert nur den
  *Zeitplan* — das Tick-basierte Round-Robin — denn das ist das mentale Modell;
  er simuliert weder echte Zeit noch echten I/O.
- **\`await\` auf irgendetwas ist ein Yield.** Das Warten auf ein Sleep, ein
  Future oder einen I/O-Aufruf macht alle dasselbe: den Tick zurückgeben. Der
  Unterschied liegt darin, *wann* sie weiterlaufen.
- **Ein Thread, viele Coroutinen.** Die Concurrency hier ist *kooperativ*:
  Kein Task läuft, es sei denn, ein anderer übergibt die Kontrolle. Deshalb
  kann ein einziger Task ohne \`await\` den Loop hungern lassen (starve) — genau
  die Lektion, die das Tick-Modell sichtbar macht.
- **\`gather\`** führt eine Gruppe von Tasks aus und sammelt deren Ergebnisse;
  **Locks** und Queues fügen eine Reihenfolge hinzu, wenn Tasks sich über
  gemeinsamen Daten abstimmen müssen (diese Serie beschränkt sich auf
  geteilte Lists, damit die Überlagerung lesbar bleibt).
`,
    threading: `## Beginner

Stell dir **zwei Kinder und einen Bonbon-Behälter** vor. Die Aufgabe jedes
Kindes ist: „Schau, wie viele Bonbons im Behälter sind, nimm die Zahl auf, und
schreibe dann die Zahl plus eins auf den Behälter." Wenn das erste Kind hinschaut
(0) und *bevor* es schreibt, das zweite Kind auch hinschaut (0), schreiben dann
beide „1". Der Behälter zeigt **1** — obwohl zwei Kinder Bonbons reingetan haben.
Die Zählung eines Kindes wurde **überschrieben**. Das ist die ganze Idee: zwei
Personen an einer gemeinsamen Sache, die sich auf die Füße treten. Eine
**Lock** ist ein kleines Schild, das sagt „nur eine Person darf gleichzeitig
den Behälter anfassen" — das zweite Kind muss draußen warten, bis das erste das
Schild zurücklegt.

\`\`\`schematic
{
  "id": "threading-lost-update",
  "title": "A read-modify-write splits across two threads",
  "nodes": [
    {
      "id": "box",
      "label": "box",
      "sub": "[0] · shared",
      "type": "buffer"
    },
    {
      "id": "t1",
      "label": "thread 1",
      "sub": "v = box[0]  →  v = 0"
    },
    {
      "id": "t2",
      "label": "thread 2",
      "sub": "v = box[0]  →  v = 0"
    },
    {
      "id": "w1",
      "label": "thread 1",
      "sub": "box[0] = v + 1  →  [1]"
    },
    {
      "id": "w2",
      "label": "thread 2",
      "sub": "box[0] = v + 1  →  [1]  (clobbers!)"
    },
    {
      "id": "lost",
      "label": "box = [1]",
      "sub": "expected [2] — one update lost",
      "type": "note"
    }
  ],
  "edges": [
    {
      "from": "t1",
      "to": "box",
      "label": "reads 0",
      "dashed": true
    },
    {
      "from": "t2",
      "to": "box",
      "label": "reads 0",
      "dashed": true
    },
    {
      "from": "w1",
      "to": "box",
      "label": "writes 1"
    },
    {
      "from": "w2",
      "to": "box",
      "label": "writes 1"
    },
    {
      "from": "w2",
      "to": "lost"
    }
  ],
  "legend": [
    {
      "color": "coral",
      "label": "a thread reads the shared box"
    },
    {
      "color": "amber",
      "label": "a thread writes it back"
    },
    {
      "color": "muted",
      "label": "the lost-update result"
    }
  ]
}
\`\`\`

## Intermediate

Ein **Thread** ist ein *Aufruf, der an seinem eigenen Ort läuft*, aber dennoch
den **gleichen Speicher** nutzt wie alle anderen. Ein
**threading.Thread(target, args)**-Objekt läuft noch nicht — es ist ein
nicht-gestarteter Aufruf (wie ein Coroutine-Objekt, nur für Threads).

- \`t.Thread(bump, (box,))\` baut einen Thread, der \`bump(box)\` ausführen wird.
- \`w.start()\` markiert ihn als laufend. Tatsächlich läuft er **innerhalb von
  \`w.join()\`**.
- \`w.join()\` ist der **Scheduler**: Er führt die gestarteten Threads eine
  **Anweisung** nach der anderen im Round-Robin aus, bis sie fertig sind.
- Weil er eine Anweisung nach der anderen abarbeitet, können zwei Threads, die
  denselben **Objekt** lesen und schreiben, auf ihm überlagert ablaufen.

Hier gibt es keine echten OS-Threads oder CPU-Kerne — die *Preemption* wird
simuliert, und die Überlagerung zeigt sich darin, was der gemeinsame Objekt am
Ende enthält.

## Advanced

Das mentale Modell: **Threads teilen sich den Heap, und sie werden nach jeder
Anweisung preempted.** Diese Preemption ist die ganze Geschichte.

- Eine normale Zuweisung wie \`box[0] = box[0] + 1\` sieht atomar aus, aber ein
  echtes Read-Modify-Write ist in Wahrheit *lesen, dann berechnen, dann
  schreiben* — drei Schritte. Wenn ein Thread zwischen Lesen und Schreiben
  unterbrochen werden kann, liest der andere Thread den **veralteten** Wert.
- Um das Race sichtbar zu machen, wird die Incrementierung also in zwei
  Anweisungen aufgeteilt — \`v = box[0]\` und dann \`box[0] = v + 1\` — genau
  das Lesen-dann-Schreiben, zwischen das ein Scheduler sich schieben kann.
- Die ständige Frage: *Welche Threads können auf diesem Objekt überlagert
  ablaufen, und verliert die Reihenfolge ihrer Lese- und Schreibzugriffe
  Information?*
- Eine **Lock** beantwortet sie: \`lk.acquire()\` / \`lk.release()\` umschließen
  einen kritischen Abschnitt (critical section), damit immer nur ein Thread
  darin ist.

## Expert

Die Mechanik, präzise.

- Ein Thread speichert \`{target, name, status, pc, locals, returnValue}\`.
  \`pc\` ist der Programmzähler; \`locals\` sind die gespeicherten Variablen
  seines Frames; \`status\` wandert **not-started → running ⇄ blocked → done**.
- \`threadJoin\` round-robin-tert jeden gestarteten Thread. In jedem Zug
  schiebt er die gespeicherten Locals des Threads auf den Frame-Stack und führt
  genau **eine Anweisung** aus (\`stepThread\`), speichert dann die Locals wieder
  ab und preemptet. Eine Anweisung pro Zug ist das, was die Überlagerung
  erzwingt.
- \`lockAcquire\` auf einer freien Lock (oder einer, die *dieser* Thread hält)
  nimmt sie. Wird sie von *einem anderen* Thread gehalten, **suspendiert** sie
  den Aufrufer (\`status\` → blocked, \`pc\` bleibt auf dem \`acquire()\`) und
  versucht es im nächsten Zug erneut — sie blockiert also, bis der Halter
  \`release()\` aufruft. Anders als ein einmaliges \`await\` rückt ein blockierendes
  \`acquire\` **nicht** über sich hinaus; es läuft erneut, bis es gewährt wird.
- Ein vollständiger Rundgang ohne echten Fortschritt ist ein **Deadlock**
  (zirkuläres Lock-Warten); der Scheduler erkennt ihn und stoppt, statt zu
  hängen.

\`\`\`schematic
{
  "id": "threading-lock-critical-section",
  "title": "A lock makes the read-modify-write atomic",
  "nodes": [
    {
      "id": "lk",
      "label": "lock",
      "sub": "a gate: one holder at a time",
      "type": "note"
    },
    {
      "id": "t1a",
      "label": "thread 1",
      "sub": "acquire → reads 0 → writes 1"
    },
    {
      "id": "t1b",
      "label": "thread 1",
      "sub": "release"
    },
    {
      "id": "t2a",
      "label": "thread 2",
      "sub": "acquire (waits until release)"
    },
    {
      "id": "t2b",
      "label": "thread 2",
      "sub": "reads 1 → writes 2"
    },
    {
      "id": "ok",
      "label": "box = [2]",
      "sub": "both updates land",
      "type": "note"
    }
  ],
  "edges": [
    {
      "from": "lk",
      "to": "t1a",
      "label": "held by t1"
    },
    {
      "from": "t1a",
      "to": "t1b"
    },
    {
      "from": "t1b",
      "to": "t2a",
      "label": "frees the gate"
    },
    {
      "from": "lk",
      "to": "t2a",
      "label": "now held by t2"
    },
    {
      "from": "t2a",
      "to": "t2b"
    },
    {
      "from": "t2b",
      "to": "ok"
    }
  ],
  "legend": [
    {
      "color": "amber",
      "label": "a thread holds the lock inside its critical section"
    },
    {
      "color": "muted",
      "label": "the gate and the safe result"
    }
  ]
}
\`\`\`

## Master

Wo es sich auszahlt und wo dieses Modell endet.

- **Echte Threads** laufen auf echten CPU-Kernen mit einem echten OS-Scheduler:
  nicht-deterministische Context Switches, das GIL, Cache-Kohärenz und echte
  Preemption an jeder Instruktions-Grenze. Dieser Visualizer simuliert den
  *Zeitplan* (eine Anweisung pro Zug), damit die Überlagerung **deterministisch
  und reproduzierbar** ist — eine Lehr-Eigenschaft, keine Eigenschaft von
  echtem Python.
- **\`join\` ist dein Scheduler.** In echtem Python vermischt das OS die
  Threads; hier round-robin-t \`join\` sie, damit du eine *bestimmte*
  Überlagerung *sehen* kannst. Deshalb ist die Lektion deterministisch: Das
  Race ist nicht „manchmal", sondern „immer, hier, in dieser Reihenfolge" —
  genau das macht es lehrbar.
- **Das Data Race ist echt, und die Lösung ist echt.** Ein verlorener Update auf
  gemeinsamen mutierbaren Zustand unter koncurrentem Read-Modify-Write ist der
  häufigste Concurrency-Bug. Eine Lock (oder ein atomares Objekt, oder eine
  Queue) macht den kritischen Abschnitt atomar. Alles, was diese Serie zeigt —
  gemeinsamer box, überlagertes Read-Modify-Write, die Lock, die es
  serialisiert — überträgt sich direkt auf echte Threads, asyncio mit
  gemeinsamem Zustand und Datenbank-Transaktionen gleichermaßen.
- **\`lock.acquire()\` liefert einen Wert:** Das echte
  \`Lock.acquire(blocking=True)\` blockiert; hier suspendiert es den Thread und
  versucht es erneut — dasselbe *Effekt*, nur sichtbar gemacht. Eine
  **re-entrant** Lock (von demselben Thread gehalten) wird von demselben Thread
  problemlos erneut genommen, passend zum Selbsteintritt (self-reentry) einer
  echten RLock.
`,
  },
  levels: {
    'as-make-coro': {
      name: 'Einen async def aufrufen',
      brief: 'Definiere `async def greet():` und rufe `c = greet()` auf. Der Aufruf führt den Funktionskörper NICHT aus — er liefert eine **Coroutine** zurück, einen gespeicherten Ort in der Funktion.',
      lesson: `Ein **async def** ist eine Coroutine-Funktion. Ihr Aufruf **führt** den Funktionskörper **nicht** aus — er liefert eine **Coroutine**-Objekt zurück, einen gespeicherten Ort (bei Anweisung 0) in dieser Funktion. Noch ist nichts gelaufen: kein Output, kein Fortschritt. Der Funktionskörper läuft später, wenn etwas die Coroutine Tick für Tick antreibt.`,
      learning: ['Der Aufruf eines async def liefert eine Coroutine, nicht ein Ergebnis', 'Der Funktionskörper ist noch nicht gelaufen — die Coroutine ist ein gespeicherter Ort'],
      fieldNotes: ['Eine Coroutine ist ein Objekt, das man weitergeben kann (z. B. als Argument für create_task)', 'Das `await None` im Funktionskörper ist eine Suspendierung, die der Loop später trifft'],
    },
    'as-create-task': {
      name: 'Eine Coroutine in einen Task verpacken',
      brief: 'Baue `c = greet()` (eine Coroutine) und `t = a.create_task(c)`. Ein **Task** ist ein *benannter Handle* auf eine Coroutine — die Einheit, die der Event-Loop plant.',
      lesson: `Ein **Task** ist ein *benannter Handle* auf eine Coroutine — das, was der Event-Loop tatsächlich plant. \`create_task(c)\` verpackt die Coroutine \`c\` in einen Task, der im **ready**-Zustand startet: in der Warteschlange, darauf wartend, dass der Loop ihn ausführt. Task und Coroutine sind zwei Objekte: Der Task *weist auf* die Coroutine.`,
      learning: ['Ein Task ist ein benannter Handle auf eine Coroutine', 'create_task bringt die Coroutine in den ready-Zustand, in der Warteschlange des Loops'],
      fieldNotes: ['`create_task` liefert einen Task zurück — sowohl der Loop als auch `gather` nehmen Tasks', 'Eine Coroutine kann in echtem Asyncio nur einmal in einen Task verpackt werden'],
    },
    'as-run-one': {
      name: 'Den Loop starten (ein Task)',
      brief: 'Erstelle einen Task `t = a.create_task(greet())` und starte den Loop mit `a.run(t)`. Der Loop arbeitet den Task bis zur Vollendung ab — sein `print` erscheint.',
      lesson: `\`a.run(t)\` startet den **Event-Loop**. Er nimmt den Task heraus, führt dessen Coroutine bis zum nächsten \`await\` weiter (druckt dabei "hi"), der Task suspendiert, und beim nächsten Tick läuft er nach dem \`await\` weiter und gibt zurück — **erledigt**. Ein Task, ein paar Ticks, und der Loop stoppt, weil die Warteschlange leer ist.`,
      learning: ['a.run startet den Loop und arbeitet Tasks weiter, bis alle erledigt sind', 'Jeder Tick führt den aktuellen Task bis zu seinem nächsten await oder return weiter'],
      fieldNotes: ['`a.run` gibt zurück, wenn alle Tasks erledigt sind', 'Der Loop ist der Scheduler — ohne ihn läuft kein Task je'],
    },
    'as-await-yields': {
      name: 'await übergibt den Tick',
      brief: 'Zwei Tasks, `a.run(t1, t2)`. Task 1 druckt, dann `await`et — er **suspendiert**, und der Loop gibt den Tick an Task 2 weiter, bevor er zurückkommt. Schau, wie sich der Output überlagert.',
      lesson: `Das ist die ganze Lektion, sichtbar gemacht. \`first()\` druckt "1a", trifft \`await\` und **suspendiert** — der Loop wartet nicht, er geht zum *nächsten* fertigen Task. \`second()\` druckt "2" und gibt zurück. Erst dann kommt der Loop zu \`first()\` zurück, das "1b" druckt und fertig wird. Der Output \`1a, 2, 1b\` ist der Beweis: **\`await\` blockiert nie — er gibt den Tick heraus, damit jemand anderes laufen kann.**`,
      learning: ['await suspendiert den aktuellen Task und lässt den Loop den nächsten fertigen Task ausführen', 'Zwei Tasks überlagern sich (A, B, A), anstatt nacheinander zu laufen'],
      fieldNotes: ['Die Reihenfolge des Outputs — nicht die Reihenfolge des Codes — ist, wie Concurrency aussieht', '`await None` ist das minimale Yield; echter Code awaitet sleep / I/O / Futures'],
    },
    'as-produce-consume': {
      name: 'Capstone: Produzent & Konsument',
      brief: 'Zwei zusammenarbeitende Tasks über einer **gemeinsamen List**: `producer` hängt an, `consumer` liest, beide yielden bei `await`. Führe sie beide aus — sie überlagern sich, und der Konsument sieht, was der Produzent geschrieben hat.',
      lesson: `Der Capstone. Zwei Tasks **arbeiten über einer gemeinsamen List zusammen**. \`producer\` hängt "p1" an und yieldet bei \`await\`; der Loop führt \`consumer\` aus, das yieldet (also *nach* dem ersten Schreiben des Produzenten läuft) und "p1" druckt. Zurück zu \`producer\`, das "p2" anhängt und fertig wird. Der Konsument **sah** das Schreiben des Produzenten, weil beide Tasks dasselbe List-Objekt teilen — und \`await\` hat sie in der richtigen Reihenfolge angeordnet. Diese Abstimmung über Yield ist der Kern von async: **Tasks blockieren nicht, sie geben den Loop zurück, und der gemeinsame Zustand ist das, was sie austauschen.**`,
      learning: ['Tasks stimmen ab, indem sie Zustand teilen und in der richtigen Reihenfolge yielden', 'await bestimmt, wer wessen Schreiben sieht — der Konsument liest, nachdem der Produzent geschrieben hat'],
      fieldNotes: ['Echtes Asyncio nutzt Queues/Locks, um Produzenten und Konsumenten explizit zu ordnen', 'Dieses Modell behält das gemeinsame-Zustand-Bild — den Teil, den eine Memory-Brille am besten lehrt'],
    },
    'th-make-thread': {
      name: 'Einen Thread bauen',
      brief: 'Definiere `bump(box)` und baue `w = t.Thread(bump, (box,))`. Ein **Thread**-Objekt läuft noch nicht — es ist ein nicht-gestarteter Aufruf, der den Speicher des Moduls teilt.',
      lesson: `Ein **Thread** ist ein Aufruf, der in seinem eigenen Frame läuft, aber den Speicher des Moduls teilt. \`t.Thread(bump, (box,))\` **führt** \`bump\` **nicht** aus — es baut einen *nicht-gestarteten* Thread, der \`bump(box)\` ausführen *wird*. Die Zielfunktion und der gemeinsame \`box\` werden festgehalten; noch ist nichts ausgeführt worden, also ist \`box\` immer noch \`[0]\`. Wie ein Coroutine-Objekt ist ein Thread ein gespeicherter Aufruf, den man herumreichen und später starten kann.`,
      learning: ['Ein Thread-Objekt ist ein nicht-gestarteter Aufruf — die Zielfunktion ist noch nicht gelaufen', 'Threads teilen sich den Heap des Moduls — der box, den sie anfassen, ist dasselbe Objekt'],
      fieldNotes: ['`t.Thread(target, args)` ist hier positional (in dieser Teilmenge keine Keyword-Argumente)', 'Ein Thread-Objekt ist wiederverwendbar: Starte ihn, dann join ihn, um ihn laufen zu lassen'],
    },
    'th-start-join': {
      name: 'Einen Thread starten und joinen',
      brief: 'Baue den Thread, dann `w.start()` und `w.join()`. Der Join ist der **Scheduler** — er arbeitet den Thread bis zur Vollendung ab, und der gemeinsame `box` wechselt von `[0]` auf `[1]`.',
      lesson: `\`start()\` markiert den Thread als laufend; tatsächlich wird er innerhalb von \`w.join()\` ausgeführt. Der **Join ist der Scheduler**: Er arbeitet den Thread Anweisung für Anweisung ab, bis er fertig ist. \`bump\` liest \`box[0]\` (0) und schreibt dann \`v + 1\` zurück — der gemeinsame box geht also \`[0] → [1]\`. Ein Thread, ein sauberes Read-Modify-Write, eine Incrementierung. Noch gibt es kein Race, weil nur ein Thread den box anfässt.`,
      learning: ['join() ist der Scheduler, der einen gestarteten Thread tatsächlich ausführt', 'Ein einzelner Thread macht sein Read-Modify-Write atomar — mit nur einem gibt es kein Race'],
      fieldNotes: ['In echtem Python führt das OS den Thread aus; hier round-robin-t join ihn, damit du ihn beobachten kannst', 'Der Thread hat den gemeinsamen box an Ort und Stelle verändert — das Modul sieht [1]'],
    },
    'th-race': {
      name: 'Zwei Threads, ein box: der verlorene Update',
      brief: 'Führe **zwei** Threads aus, die denselben `box` erhöhen, ohne Lock. Anweisung für Anweisung preempted, lesen beide `box[0]=0`, bevor einer schreibt — also endet `box` bei **1, nicht 2**. Das verlorene Update ist das Data Race.',
      lesson: `Das ist die ganze Lektion. \`join\` round-robin-t die beiden Threads **eine Anweisung nach der anderen**: Thread 1 liest \`box[0]\` in \`v\` (→ 0); dann liest Thread 2 \`box[0]\` in *seinem* \`v\` (→ 0, der box ist immer noch 0); dann schreibt Thread 1 \`v + 1\` (box → 1); dann schreibt Thread 2 *sein* \`v + 1\` (box → 1). Beide Threads haben dieselbe **veraltete 0** gelesen, also überschreibt die zweite Schreibvorgang die erste — der box endet bei **1**, nicht 2. Das ist ein **Data Race**: ein Read-Modify-Write, so überlagert, dass ein Update verloren geht. Der Bug liegt in keinem der Threads; er liegt im *Teilen* des box ohne Koordination.`,
      learning: ['Zwei Threads auf einem Objekt überlagern sich Anweisung für Anweisung', 'Ein Read-Modify-Write, über die Überlagerung aufgeteilt, verliert ein Update (der box endet bei 1, nicht 2)'],
      fieldNotes: ['Echte CPython-Threads treffen auf genau dieses Race — das GIL macht `x = x + 1` auf gemeinsamem Zustand NICHT sicher', 'Das Race ist *nicht-deterministisch* auf echten CPUs; hier macht join eine Überlagerung deterministisch, damit es lehrbar ist'],
    },
    'th-lock': {
      name: 'Das Race mit einer Lock beheben',
      brief: 'Gib jedem Thread eine gemeinsame `lk = t.Lock()` und umschließe das Read-Modify-Write mit `lk.acquire()` / `lk.release()`. Jetzt ist immer nur ein Thread darin — der box endet bei **2**. Das Race ist weg.',
      lesson: `Die Lösung. \`lk.acquire()\` ist das Tor: Thread 1 nimmt es und macht sein ganzes Read-Modify-Write (0 → 1) **bevor** es es freigibt. Wenn Thread 2 versucht, es zu nehmen, ist die Lock **gehalten**, also *blockiert* (suspendiert) es und versucht es im nächsten Zug erneut — es tritt erst ein, wenn Thread 1 die Lock freigegeben hat. Im kritischen Abschnitt liest es jetzt den **aktualisierten** box (1) und schreibt 2. Die gegenseitige Ausschluss (mutual exclusion) machte das Read-Modify-Write gegenüber dem anderen Thread **atomar**, also kommen beide Incrementierungen an: Der box endet bei **2**, und die Lock ist wieder frei. Das Data Race ist weg, weil der gemeinsame Zustand immer nur von einem Thread auf einmal angefasst wird.`,
      learning: ['Eine Lock macht einen kritischen Abschnitt atomar — immer nur ein Thread darin', 'acquire() auf einer gehaltenen Lock blockiert den Aufrufer, bis der Halter release()t', 'Die Lock behebt den verlorenen Update: Der box endet bei 2, nicht 1'],
      fieldNotes: ['Umschließe den *möglichst kleinsten* kritischen Abschnitt — eine Lock zu lange zu halten, serialisiert Threads, die es nicht nötig hätten', 'Eine re-entrant Lock (eine echte RLock) lässt denselben Thread erneut acquire; hier wird eine selbst gehaltene Lock problemlos genommen'],
    },
    'th-critical-capstone': {
      name: 'Capstone: Blocken, warten und in der richtigen Reihenfolge weiterlaufen',
      brief: 'Zwei Threads, eine Lock: `hold` nimmt die Lock, druckt, gibt sie frei; `wait_then` versucht sie zu nehmen und **blockiert**, bis `hold` sie freigibt, und läuft dann weiter. Die Ausgabereihenfolge beweist, dass die Lock sie geordnet hat: `A holds` vor `B proceeds`.',
      lesson: `Der Capstone: **Gegenseitiger Ausschluss als Reihenfolge**. \`ta\` (\`hold\`) nimmt die Lock zuerst, druckt "A holds" und gibt sie frei. \`tb\` (\`wait_then\`) versucht, sie zu nehmen, aber die Lock ist **gehalten** — also blockiert es, suspendiert auf dem \`acquire()\`, ohne voranzukommen. Wenn \`ta\` die Lock freigibt, wird \`tb\` erneut versucht, nimmt sie und druckt *dann* "B proceeds". Schau auf die Memory-Canvas: Während \`tb\` blockiert, liest sein Thread-Box **blocked** (coral) und das Lock-Box liest **HELD** (gehalten) von \`ta\`. Der Output — "A holds" dann "B proceeds" — ist der Beweis, dass die Lock zwei unabhängige Threads auf gemeinsamem Zustand *geordnet* hat. Das ist genau das, was eine Lock dir bringt: nicht nur Korrektheit, sondern eine **deterministische Reihenfolge** über einen kritischen Abschnitt.`,
      learning: ['acquire() auf einer gehaltenen Lock blockiert den Aufrufer (status → blocked), bis release', 'Gegenseitiger Ausschluss gibt dir eine Reihenfolge, nicht nur Sicherheit — B kann nur nach A’s Freigabe laufen', 'Ein blockierter Thread ist ein sichtbarer Zustand, kein Rätsel — die Canvas zeigt ihn'],
      fieldNotes: ['So verhält sich jeder durch eine Mutex geschützte kritische Abschnitt — die Ausgabereihenfolge ist der Vertrag', 'Deadlock ist der Fehlzustand von Locks: Wenn A auf eine Lock wartete, die B hielt, und B auf eine Lock wartete, die A hielt, würde keiner je freigeben'],
    },
  },
};
