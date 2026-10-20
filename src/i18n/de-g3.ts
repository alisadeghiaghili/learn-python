import type { LevelGroup } from './types';

export const deG3: LevelGroup = {
  seriesTitles: {
    'copy-semantics': 'Kopier-Semantik',
    'iterators': 'Iteratoren & Iterables',
    'functional': 'Standardwerte & funktionale Werkzeuge',
    'plotting': 'Diagramme & Capstone',
  },
  deepLessons: {},
  levels: {
    'shallow-copy-dict': {
      name: 'Shallow Copy',
      brief: 'Führe einen shallow Copy eines dict aus, das eine verschachtelte list enthält. `b` wird ein *neues* dict, zeigt aber auf dieselbe **innere** list wie `a`. Sieh die beiden Bernstein-Elemente, die auf ein einziges list-Box zulaufen.',
      learning: ['Ein Shallow Copy ist ein neuer äußerer Container', 'Verschachtelte Container werden geteilt, nicht kopiert'],
      fieldNotes: ['`.copy()` und `copy.copy()` sind beide shallow', 'Deshalb „leckt" eine Mutation eines verschachtelten Elements durch einen Shallow Copy'],
      lesson: `Ein *shallow* Copy erzeugt einen **neuen äußeren Container**, nimmt die Container *darin* aber weiter. \`a.copy()\` baut ein frisches dict \`b\`, doch sowohl \`a['k']\` als auch \`b['k']\` zeigen auf **dieselbe** innere list.

Beobachte das Canvas: zwei dicts, ein geteiltes list-Box in der Mitte mit zwei Bernstein-Elementen, die darauf zulaufen. Dieses geteilte Kind-Element ist die gesamte Idee von „shallow" — die Oberfläche wird kopiert, das Innere geteilt.`,
    },
    'deep-copy-independence': {
      name: 'Deep Copy',
      brief: 'Erzeuge einen Deep Copy von `a`, sodass `b` **vollständig unabhängig** ist — selbst die innere list wird ein separates Objekt. Keine Box wird zwischen ihnen geteilt.',
      learning: ['Ein Deep Copy klonnt verschachtelte Container rekursiv', 'Nach einem Deep Copy wird nichts geteilt'],
      fieldNotes: ['`copy.deepcopy` ist das Werkzeug vor dem Verändern einer Struktur, die dir nicht gehört', 'Shallow ist schneller, teilt aber innere Objekte — Deep ist langsamer, aber sicher'],
      lesson: `Ein *deep* Copy baut **jede** Ebene neu. \`cp.deepcopy(a)\` erstellt ein neues dict *und* eine neue innere list, sodass nichts auf \`b\`-Seite dasselbe Objekt ist wie irgendetwas auf \`a\`-Seite.

Vergleiche mit der vorherigen Level: Dort war die innere list geteilt (shallow); hier ist sie unabhängig (deep). \`import copy as cp\` bindet das simulierte \`copy\`-Modul; \`cp.deepcopy\` reserviert dann frische Boxen bis in die unterste Ebene.`,
    },
    'shared-child-mutation': {
      name: 'Das geteilte Kind verändert beide',
      brief: 'Führe einen Shallow Copy von `a` aus, dann füge über `a` zu der geteilten inneren list hinzu. Da `b` diese list teilt, ändert sich auch `b` — ganz ohne Berührung.',
      learning: ['Eine Mutation eines geteilten verschachtelten Objekts ist über alle Aliase sichtbar', 'Shallow Copy + verschachtelte Mutation ist der klassische Haken'],
      fieldNotes: ['Greife zu einem Deep Copy (oder defensiven Kopien), bevor du geteilte Daten veränderst', 'Erkenn das Teilen mit `id(a[1]) == id(b[1])`'],
      lesson: `Hier ist das „Aha-Moment". \`a\` und \`b\` sind verschiedene lists, aber ihre innere list ist das **selbe Objekt**. Der Aufruf \`a[1].append(3)\` mutiert diese geteilte innere list — wenn du \`b\` liest, siehst du die Änderung also auch, obwohl du nur \`a\` berührt hast.

Das ist der häufigste Copy-Fehler in Python. Das Canvas macht ihn unvermeidbar sichtbar: eine innere Box, zwei Kanten, eine Mutation, zwei Beobachter. Ein *deep* Copy hätte die geteilte Kante durchtrennt und dies verhindert.`,
    },
    'iter-basic': {
      name: 'Erzeuge einen Iterator',
      brief: 'Erstelle `it` mit `iter` als Iterator über die list `xs`. `it` ist ein *neues Objekt*, das sich seine Position in `xs` merkt.',
      learning: ['Ein Iterable liefert einen Iterator', 'Der Iterator ist ein separates Objekt, das einen Cursor hält'],
      fieldNotes: ['`iter()` ist das, was die `for`-Schleife für dich aufruft', 'Ein Iterable kann viele unabhängige Iteratoren herausgeben'],
      lesson: `Ein **Iterable** (wie eine list) kann dir einen **Iterator** übergeben. \`it = iter(xs)\` reserviert ein *neues* Objekt im Heap, das eine Referenz auf \`xs\` **plus einen Cursor** hält, der bei 0 startet.

Beobachte das Canvas: ein neues \`list_iterator\`-Box erscheint mit einer Kante zurück zur list \`xs\`. Der Iterator ist ein separates Objekt, das die list *durchläuft*, ein Element nach dem anderen. Die list selbst bleibt unberührt — die Position lebt im Iterator, nicht in der list.`,
    },
    'iter-next': {
      name: 'Voranschreiten mit next()',
      brief: 'Rufe `next(it)` auf, um das erste Element vom Iterator abzuholen und seinen Cursor voranzubewegen.',
      learning: ['`next(it)` gibt das aktuelle Element zurück und bewegt den Cursor weiter', 'Der Cursor ist ein Zustand, der im Iterator-Objekt gespeichert ist'],
      fieldNotes: ['`for` ist syntaktischer Zucker über wiederholtem `next()`', 'In echtem Code rufst du `next()` kaum von Hand auf'],
      lesson: `\`next(it)\` gibt das Element an der Cursor-Position zurück und **bewegt den Cursor dann weiter**. Nach einem Aufruf hält \`first\` den Wert \`1\`, und der Iterator ist jetzt bei Index 1.

Der Cursor ist ein echter Zustand, der im Iterator-Objekt gespeichert ist — du kannst ihn auf dem Canvas voranschreiten sehen. Genau das macht eine \`for x in xs\`-Schleife, versteckt im Inneren der Schleife: Sie ruft \`next()\` auf, bis der Iterator aufgebraucht ist. Hier tun wir es bewusst in sichtbaren Einzelschritten.`,
    },
    'iter-independence': {
      name: 'Zwei Iteratoren, eine list',
      brief: 'Erstelle **zwei** Iteratoren über dieselbe list. Das Voranschreiten des einen darf den anderen nicht bewegen — jeder hat seinen eigenen Cursor.',
      learning: ['Zwei Iteratoren über einer list sind unabhängig', 'Jeder Iterator besitzt seinen eigenen Cursor'],
      fieldNotes: ['Du kannst dieselbe Sammlung an zwei Stellen gleichzeitig durchlaufen', 'Die Quell-Liste während der Iteration zu mutieren ist undefiniert — meide es'],
      lesson: `Der zweimalige Aufruf von \`iter(xs)\` liefert **zwei separate Iterator-Objekte**, die jeweils auf dieselbe *list* zeigen, aber jeweils ihren *eigenen* Cursor haben. Das Voranschreiten von \`jt\` lässt \`it\` bei 0.

Das Canvas zeigt zwei Iterator-Boxen, beide mit Kanten zu einer einzigen list, aber ihre Cursor sind unabhängig. Das ist die Aliasing-Idee von früher, angewandt auf Iteratoren: geteilte Quelle, unabhängiger Zustand.`,
    },
    'iter-exhaust': {
      name: 'Exhausted den Iterator',
      brief: 'Rufe `next(it)` auf, bis der Iterator jedes Element durchlaufen hat — am Ende ist er **erschöpft** (Cursor am Ende).',
      learning: ['Ein Iterator ist erschöpft, wenn sein Cursor das Ende erreicht', 'Erschöpfung ist das, wie die Iteration weiß, dass sie aufhören muss'],
      fieldNotes: ['`StopIteration` beendet eine `for`-Schleife', 'Ein erschöpfter Iterator ist wiederverwendbar, indem man `iter()` erneut auf der Quelle aufruft'],
      lesson: `Halte den Aufruf von \`next(it)\` aufrecht und der Cursor klettert durch 1, 2, 3. Nach dem letzten Element ist der Iterator **erschöpft** — sein Cursor sitzt am Ende der list.

Im echten Python wirft \`next()\` auf einem erschöpften Iterator \`StopIteration\`; genau das ist das Signal, auf das eine \`for\`-Schleife achtet, um zu wissen, dass sie fertig ist. Hier ist das Ziel einfach, das Ende zu erreichen: Der Iterator hat die gesamte list konsumiert, ohne dass sich die list jemals verändert hat.`,
    },
    'defaultdict-basic': {
      name: 'Ein dict, das seine Defaults erfindet',
      brief: 'Mit `d` als `defaultdict(int)` liest du einen Key, der noch nicht existiert. Ein normales dict würde `KeyError` werfen; hier sollte `n` als `0` zurückkommen — und der Key wird nun gespeichert.',
      learning: ['Ein defaultdict füllt fehlende Keys aus einer Standard-Fabrik', 'Das Lesen eines fehlenden Keys gibt den Default zurück UND speichert ihn'],
      fieldNotes: ['`defaultdict(int)` ist die idiomatische Art zu zählen: `counts[word] += 1`', 'Im Gegensatz zu `.get()` bleibt der automatisch erzeugte Wert im dict'],
      lesson: `Ein **defaultdict** ist ein dict, das weiß, wie man fehlende Werte erfindet. \`defaultdict(int)\` sagt: „Wenn ich einen Key verpasse, gib mir zurück, was \`int()\` erzeugen würde" — und \`int()\` ist \`0\`.

Das Lesen von \`d['missing']\` tut auf einmal zwei Dinge: Es liefert \`0\` **und** speichert dieses \`0\` unter dem Key (beobachte, wie das Box von leer auf \`{'missing': 0}\` wächst). Mit einem normalen dict würde derselbe Lesezugriff mit \`KeyError\` abstürzen. Das Tag \`⚙ default: int()\` am Box ist die Fabrik, die dies möglich macht.`,
    },
    'defaultdict-list': {
      name: 'Auto-Default zu einer frischen list',
      brief: 'Nutze `d = c.defaultdict(list)` und lese `d["nums"]`. Eine int-Fabrik würde eine Zahl zurückgeben — hier baut die Fabrik eine völlig neue leere list, eine frische Heap-Box.',
      learning: ['Die Standard-Fabrik kann Container bauen, nicht nur Zahlen', 'Gruppierung: `groups[key].append(x)` erzeugt die list bei erster Verwendung automatisch'],
      fieldNotes: ['`defaultdict(list)` + `.append()` ersetzt explizite `if key in d`-Prüfungen', 'Jeder fehlende Key bekommt seine eigene *frische* list — sie sind nicht geteilt'],
      lesson: `Die Fabrik ist jede aufrufbare Funktion. \`defaultdict(list)\` sagt: „Wenn ich einen Key verpasse, gib mir eine frische \`list()\`." Deshalb erzeugt \`xs = d['nums']\` eine **neue leere list** im Heap und speichert sie unter \`"nums"\` — beobachte, wie ein neues türkises \`list\`-Box erscheint und in das dict verdrahtet wird.

Das ist das Arbeitstier-Muster für **Gruppierung**: \`by_category[name].append(item)\` funktioniert sogar beim ersten Auftreten eines Namens, weil ein fehlender Name automatisch eine leere list erzeugt, die man anhängen kann. Kein \`if name not in by_category\`-Boilerplate.`,
    },
    'map-lazy': {
      name: 'map: ein lazy Transform',
      brief: 'Mit `xs = [\'1\', \'2\']` baue `ms = map(int, xs)` auf und hole das erste Ergebnis mit `next(ms)`. `ms` ist keine list — es ist ein *lazy Iterator*, der sich sowohl die Quelle als auch die anzuwendende Funktion merkt.',
      learning: ['`map(fn, it)` liefert einen lazy Iterator, keine list', 'Das map-Objekt hält sowohl die Quelle als auch die anzuwendende Funktion'],
      fieldNotes: ['`list(map(fn, it))` ist die eager-Form, die man im echten Code am häufigsten sieht', 'map/filter lassen sich sauber verkettend: Jeder ist einfach wieder ein Iterator-Objekt'],
      lesson: `\`map(int, xs)\` baut **keine** list. Es liefert einen **map-Iterator** — ein Heap-Objekt, das zwei Referenzen trägt (beobachte die zwei Bernstein-Kanten): die *Quelle*, die es durchläuft, und die *Funktion* \`int\`, die es auf jedes Element anwendet.

Rufe \`next(ms)\` auf, und es zieht ein rohes Element von der Quelle, wendet \`int\` darauf an und liefert das Ergebnis zurück: \`'1' → 1\`. Noch wird nichts anderes berechnet — \`map\` ist **lazy**, verwandelt ein Element nach dem anderen auf Abruf, genau wie die Iteratoren aus der vorherigen Serie, aber mit einer angeflanschten Funktion.`,
    },
    'filter-truthy': {
      name: 'filter: behalte, was truthy ist',
      brief: 'Mit `xs = [0, 1, 2, 3]` baue `fs = filter(bool, xs)` auf und hole das erste Ergebnis. `0` ist falsy, daher **überspringt** der Filter es und liefert `1` zurück.',
      learning: ['`filter(pred, it)` liefert nur die Elemente, die die Prädikat bestehen', 'Falsy-Werte (0, leer, None) werden von `filter(bool, ...)` verworfen'],
      fieldNotes: ['`filter(None, it)` entfernt falsy-Elemente, ohne eine Funktion zu benennen', 'Sowohl `map` als auch `filter` liefern Iteratoren, daher ketten sie sich lazy'],
      lesson: `\`filter\` ist das Schwesterglied von \`map\`. Statt jedes Element zu *transformieren*, **testet** es jedes und wirft die aus, die durchfallen. \`filter(bool, xs)\` behält nur die Elemente, deren Wahrheitswert true ist — also wird \`0\` (falsy) still übersprungen und der erste überlebende Wert ist \`1\`.

Wie bei \`map\` ist das Ergebnis ein **lazy Iterator** im Heap. Er zieht von der Quelle ein Element nach dem anderen, und die Kante „Funktion anwenden" trägt hier das *Prädikat* (\`bool\`) statt eines Transformers. \`map\` formt Werte um; \`filter\` verwirft sie.`,
    },
    'plot-scatter': {
      name: 'Erstes Diagramm',
      brief: 'Erstelle zwei lists `x` und `y`, dann `scatter(x, y)`, um ein Streudiagramm im Plot-Tab zu zeichnen.',
      learning: ['`scatter(xs, ys)` paart zwei lists zu (x, y)-Punkten', 'Diagramme leben in `state.plots` und werden im Plot-Tab gerendert'],
      fieldNotes: ['Echte Arbeit nutzt matplotlib; dies ist ein kleiner Stellvertreter', 'Halte die Daten (lists) und das Diagramm getrennt, wie hier'],
      lesson: `Hier verbindest du das Speichermodell mit einem Diagramm. \`scatter(x, y)\` paart die zwei lists Punkt für Punkt und schiebt eine **Plot-Spezifikation** auf \`state.plots\`.

Beobachte das Brett: ein kleiner Punkt erscheint am Badge des Plot-Tabs, und ein Klick darauf zeigt die gezeichneten Punkte. Das Diagramm ist reine Daten — eine list von \`(x, y)\`-Paaren — gerendert als SVG.`,
    },
    'plot-trend': {
      name: 'Plotte einen berechneten Trend',
      brief: 'Definiere `sq(n)`, baue eine list von quadrierten Werten, dann `line(xs, ys)`, um eine verbundene Trendlinie zu zeichnen.',
      learning: ['Berechne zuerst die Serie, dann plotte die abgestimmten lists', '`line()` verbindet die Punkte in Reihenfolge, um einen Trend zu zeigen'],
      fieldNotes: ['NumPy vektorisiert dies: `ys = sq(xs)` in einem Schritt', 'Halte `xs` und `ys` immer gleiche Länge, bevor du plottest'],
      lesson: `Hier wird die Serie **berechnet**, nicht eingegeben. \`sq\` erzeugt jedes \`y\`, die \`ys\`-list wird aus diesen Ergebnissen gebaut, und \`line(xs, ys)\` verbindet die Punkte in der Reihenfolge.

Das ist die Form echten Plottings: Einige Daten transformieren, in abgestimmte Serien sammeln, dann zeichnen. Die Funktionsaufruf-Rahmen, die du in S5 gesehen hast, verrichten Arbeit, die das Diagramm füttert.`,
    },
    'capstone-shared-mutation': {
      name: 'Capstone: Alias + Mutation + Plot',
      brief: 'Das Finale. `data` und `mirror` teilen eine list; eine Funktion erweitert sie an Ort und Stelle; dann `scatter` das Ergebnis. Alle drei Ideen auf einmal.',
      learning: ['Aliasing + In-Place-Mutation + Plotten komponieren sich', 'Eine Funktion kann ein geteiltes Objekt mutieren, selbst wenn sie über einen Alias aufgerufen wird'],
      fieldNotes: ['Dieses exakte Muster liegt reaktivem/beobachtbarem Daten zugrunde', 'Mutate-and-Publish ist der Weg, wie Diagramme mit dem Zustand synchron bleiben'],
      lesson: `Diese Level verknüpft alles, was du gelernt hast. \`data\` und \`mirror\` sind ein **Alias** für eine list. \`bump\` **mutiert** sie an Ort und Stelle über \`mirror\`, sodass auch \`data\` das Wachstum sieht — dann **plotten** wir das Ergebnis.

Drei Kernideen in sechs Anweisungen: Aliasing (S2), In-Place-Mutation, die aus einer Funktion entkommt (S4/S5), und das Verwandeln von Daten in ein Diagramm (S6). Wenn du alle drei gleichzeitig auf dem Canvas sehen kannst, verstehst du das Modell.`,
    },
  },
};
