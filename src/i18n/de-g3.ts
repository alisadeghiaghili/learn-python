import type { LevelGroup } from './types';

export const deG3: LevelGroup = {
  seriesTitles: {
    'copy-semantics': 'Kopier-Semantik',
    'iterators': 'Iteratoren & Iterables',
    'functional': 'Standardwerte & funktionale Werkzeuge',
    'plotting': 'Diagramme & Capstone',
  },
  deepLessons: {
    plotting: `## Beginner

Ein Diagramm ist eine **Entscheidung**, keine Deko. Deine Daten stellen schweigend eine Frage, und der Diagramm-*Typ* ist die Antwort. Bevor du ein Diagramm wählst, benenne die Frage. Die fünf Fragen, die du fast immer beantworten willst:

- **Zusammenhang** — „Wie hängen diese beiden Zahlen zusammen?" → scatter, line, area
- **Verteilung** — „Wie sind die Werte verteilt?" → histogram, boxplot
- **Zusammensetzung** — „Welchen Anteil hat jeder Teil am Ganzen?" → pie, area
- **Vergleich** — „Welche Kategorie ist größer?" → bar
- **Häufigkeit** — „Wie oft tritt etwas auf?" → countplot
- **Korrelation** — „Wie stark hängen viele Spalten zusammen?" → heatmap

Wähle das Diagramm, das zur Frage passt — dann erklärt es sich selbst.

## Intermediate

Die Entscheidungslandkarte. Jeder Pfeil heißt „diese Frage wird am besten von diesem Diagramm beantwortet":

- Zusammenhang ← **scatter / line / area / reg**
- Verteilung ← **hist / boxplot**
- Zusammensetzung ← **pie / area**
- Vergleich ← **bar**
- Häufigkeit ← **countplot**
- Korrelation ← **heatmap**

Einige schnelle Regeln, die die meisten Entscheidungen lösen:

- Zwei stetige Serien → **scatter** (sind sie korreliert?) oder **line** (ist eine geordnet, z. B. Zeit?).
- Eine Spalte roher Zahlen → **hist** (die Form) oder **boxplot** (Spanne + Ausreißer).
- Wenige Kategorien mit Werten → **bar**; wenn die Werte ein *Anteil eines Ganzen* sind → **pie**.
- Viele Kategorien, nur zählen → **countplot**.
- Ein Netz an Werten (Zeilen × Spalten) → **heatmap**.

## Advanced

**So baust du jedes ein.** Jedes Diagramm ist ein einziger Builtin, der ein Plot-Spec auf \`state.plots\` legt; der Plot-Tab rendert es. Hier die Argumentform jedes, mit einem ausführbaren Beispiel:

| Diagramm | Aufruf | Was jedes Argument ist |
|----------|--------|------------------------|
| scatter | \`scatter(xs, ys)\` | zwei ausgerichtete Zahlenlisten |
| line | \`line(xs, ys)\` | zwei ausgerichtete Zahlenlisten, in Reihenfolge |
| area | \`area(xs, ys)\` | zwei ausgerichtete Zahlenlisten, unter der Linie gefüllt |
| reg | \`reg(xs, ys)\` | zwei ausgerichtete Zahlenlisten; passt eine Linie |
| bar | \`bar(labels, values)\` | eine Label-Liste, eine Werte-Liste |
| countplot | \`countplot(labels)\` | eine Liste roher Labels (darf sich wiederholen) |
| hist | \`hist(values)\` | eine Liste roher Zahlen (automatisch gebinnt) |
| pie | \`pie(labels, values)\` | eine Label-Liste, eine Werte-Liste |
| boxplot | \`boxplot(values)\` | eine Liste roher Zahlen (Quartile berechnet) |
| heatmap | \`heatmap(rows, cols, matrix)\` | Zeilen-Labels, Spalten-Labels, eine Liste von Listen |

Zwei Formen merken: **ausgerichtete Zahlenlisten** (\`scatter(xs, ys)\`) für die 2D-Diagramme, und **Labels + Werte** (\`bar(labels, values)\`) für die Kategorie-Diagramme. Die Ausnahme ist \`heatmap\`, das eine *Matrix* nimmt — eine Liste von Listen, eine innere Liste pro Zeile.

\`\`\`python
xs = [1, 2, 3]
ys = [1, 4, 9]
scatter(xs, ys)        # Zusammenhang
reg(xs, ys)            # dieselben Daten, passte Linie
\`\`\`

## Expert

Die Datenform entscheidet, nicht dein Geschmack. Zwei Fallen, die in der Praxis auffallen:

- **bar braucht Labels und Werte; countplot nur rohe Labels.** Hast du sich wiederholende Kategorien, nutze \`countplot\` — es zählt selbst. Hast du schon je Kategorie einen Wert, nutze \`bar\`.
- **hist und boxplot nehmen rohe Werte, nicht vorgebinnte.** \`hist(data)\` und \`boxplot(data)\` nehmen eine flache Zahlenliste und binnen / berechnen Quartile selbst. Nicht vorab berechnen.
- **pie ist ein Anteil, bar ist eine Größe.** Summieren sich die Werte zu einem sinnvollen Ganzen, ist ein pie ehrlich; werden die Kategorien nur verglichen, ist es ein bar.
- **reg liefert den Fit.** \`reg(xs, ys)\` berechnet die kleinste-Quadrate-Steigung und den y-Abschnitt im Engine und zeichnet die Linie durch die Punkte — Diagramm und Mathematik stimmen überein.

## Master

Produktionsnamen, damit du den echten Code liest. Jedes Diagramm hier hat einen matplotlib / seaborn-Ableger:

- scatter → \`plt.scatter\` · line → \`plt.plot\` · area → \`plt.fill_between\`
- bar → \`plt.bar\` / \`sns.barplot\` · countplot → \`sns.countplot\`
- hist → \`plt.hist\` / \`sns.histplot\` · boxplot → \`plt.boxplot\` / \`sns.boxplot\`
- pie → \`plt.pie\` · heatmap → \`plt.imshow\` / \`sns.heatmap\`
- reg → \`sns.regplot\` / \`sns.lmplot\`

Wo es kaputtgeht: eine line setzt Reihenfolge voraus und lügt bei ungeordneten Kategorien. Ein pie mit mehr als ~6 kleinen Scheiben ist unlesbar. Eine heatmap braucht eine feste, geordnete Achse (meist normalisierte Werte), sonst codieren die Farben nichts. Die Memory-Model-Auszahlung bleibt: jedes Diagramm liest *dieselben* Listen, die du auf dem Canvas hältst — das Diagramm ist nur diese Objekte, gezeichnet.`,
  },
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
    'plot-bar': {
      name: 'Balkendiagramm',
      brief: 'Baue `labels = ["A", "B", "C"]` und `vals = [3, 5, 2]`, dann `bar(labels, vals)`. Ein Balkendiagramm vergleicht einen Wert pro Kategorie mit den anderen.',
      learning: ['`bar(labels, values)` vergleicht einen Wert pro Kategorie mit den anderen', 'Ein Balkendiagramm braucht zwei gleich lange lists: Labels und Werte'],
      fieldNotes: ['matplotlib: `plt.bar(labels, vals)` / seaborn `sns.barplot`', 'Nutze bar für eine *Größe*; pie nur, wenn die Teile ein Ganzes ergeben'],
      lesson: `Ein **Balkendiagramm** beantwortet „welche Kategorie ist größer?". Du gibst zwei gleich lange lists: \`labels\` (die Kategorien) und \`vals\` (je ein Wert). \`bar\` paart sie und zeichnet pro Kategorie einen senkrechten Balken, dessen Höhe der Wert setzt.

Das Memory-Modell ist wie scatter — zwei lists auf dem heap — aber das Diagramm liest sie *kategorisch positionell*, nicht als (x, y)-Koordinaten. Der Plot-Tab zeigt das Label unter jedem Balken und den Wert darüber.`,
    },
    'plot-countplot': {
      name: 'Countplot',
      brief: 'Baue `cats = ["red", "blue", "red"]`, dann `countplot(cats)`. Ein countplot zählt, wie oft jedes Label auftritt — keine separate Werte-list nötig.',
      learning: ['`countplot(labels)` zählt eine rohe list sich wiederholender Labels', 'Zähl die Daten, tippe die Zählung nicht — das Diagramm macht es'],
      fieldNotes: ['seaborn: `sns.countplot(labels)`', 'countplot ist die „Häufigkeit"-Frage; bar ist die „Größen vergleichen"-Frage'],
      lesson: `Ein **countplot** beantwortet „wie oft tritt etwas auf?". Im Gegensatz zu \`bar\` nimmt er eine einzige list roher Labels, die **sich wiederholen** dürfen, und zählt sie selbst: \`red\` kommt zweimal vor, sein Balken ist 2.

Das ist die Häufigkeitsfrage. Du schreibst die Zählung nie — das Diagramm zählt die list. Schau den Plot-Tab: pro eindeutigem Wert ein Balken, die Höhe die Zählung.`,
    },
    'plot-hist': {
      name: 'Histogramm',
      brief: 'Baue eine list roher Zahlen, dann `hist(values)`. Ein Histogramm splittet die Zahlen in Klassen (Bins) und zeigt, wie viele in jede fallen — die Form einer Verteilung.',
      learning: ['`hist(values)` binnt eine rohe list von Zahlen automatisch', 'Ein Histogramm zeigt die *Form* einer Verteilung, nicht Einzelwerte'],
      fieldNotes: ['matplotlib `plt.hist` / seaborn `sns.histplot`', 'Die Binanzahl ändert das Bild — zu wenige verstecken Detail, zu viele werden Rauschen'],
      lesson: `Ein **Histogramm** beantwortet „wie sind die Werte verteilt?". Du gibst eine flache list roher Zahlen; es splittet den Bereich in Klassen und zeichnet pro Klasse einen Balken für die *Anzahl* der fallenden Werte. Diese Silhouette ist die **Form der Verteilung** — ein Gipfel, wo Werte haufen, ein Schwanz, wo sie dünner werden.

Du gibst rohe Werte, keine vorab gemachten Zählungen. Das Engine binnt sie, damit Diagramm und Daten immer stimmen.`,
    },
    'plot-pie': {
      name: 'Kuchendiagramm',
      brief: 'Baue `parts = ["x", "y"]` und `vals = [70, 30]`, dann `pie(parts, vals)`. Ein Kuchendiagramm zeigt den Anteil jedes Teils am Ganzen.',
      learning: ['`pie(labels, values)` zeigt den Anteil jedes Teils am Ganzen', 'Ein pie ist ein Anteilsdiagramm — nur für Teile-eines-Ganzen halten'],
      fieldNotes: ['matplotlib: `plt.pie(vals, labels=parts)`', 'Ein pie mit vielen kleinen Scheiben ist ein bar im Verkleidung — wechsle zu bar'],
      lesson: `Ein **Kuchendiagramm** beantwortet „welchen Anteil hat jeder Teil am Ganzen?". Es nutzt die gleiche Zwei-list-Form wie \`bar\` (Labels + Werte), zeichnet die Werte aber als **Scheiben eines Kreises**, damit das Auge Anteile vom Ganzen liest statt Größen.

Nutze einen pie, wenn die Werte zu etwas Sinnvollem summieren — Teile von 100 %, Stücke eines Budgets. Werden die Kategorien nur verglichen, ist bar das ehrlichere Diagramm.`,
    },
    'plot-area': {
      name: 'Flächendiagramm',
      brief: 'Baue `xs` und `ys`, dann `area(xs, ys)`. Ein Flächendiagramm ist eine Linie mit der darunter gefüllten Fläche — die kumulative Größe auf einer geordneten Achse.',
      learning: ['`area(xs, ys)` füllt den Bereich unter einer Linie', 'Ein Flächendiagramm betont die sich aufsummierende *Größe* auf einer geordneten Achse'],
      fieldNotes: ['matplotlib: `plt.fill_between(xs, ys)`', 'Gestapelte Flächendiagramme zeigen mehrere Serien, die zu einem Ganzen summieren'],
      lesson: `Ein **Flächendiagramm** ist eine Linie mit dem Bereich **darunter gefüllt**. Es hat die gleichen zwei abgestimmten Zahlenlisten wie \`line\`, aber das Füllen macht die *Größe* jedes Punktes auf einen Blick lesbar — gut, wenn die y-Werte kumulativ sind oder du betonen willst, wie viel Fläche sich angesammelt hat.

Die x-Achse muss geordnet sein (Zeit, ein Index); das Füllen ist nur auf einer geordneten Achse sinnvoll.`,
    },
    'plot-boxplot': {
      name: 'Boxplot',
      brief: 'Baue eine list von Zahlen, dann `boxplot(values)`. Ein Boxplot komprimiert eine ganze Verteilung in eine Box (Quartile) mit Whiskers und Ausreißer-Punkten.',
      learning: ['`boxplot(values)` fasst eine Verteilung in Quartile + Ausreißer zusammen', 'Die Box ist die mittlere Hälfte, die Linie der Median, die Punkte die Ausreißer'],
      fieldNotes: ['matplotlib `plt.boxplot` / seaborn `sns.boxplot`', 'Der Klassiker: mehrere Boxplots nebeneinander, um Verteilungen zu vergleichen'],
      lesson: `Ein **Boxplot** beantwortet „wie ist die Daten gestreut und wo sind die Ausreißer?" aus einer list roher Zahlen. Er berechnet die Quartile und zeichnet: eine **Box** vom 25. bis 75. Perzentil, eine Linie am **Median**, **Whiskers** bis zu den extremsten Werten im Bereich, und einen Punkt für jeden **Ausreißer** jenseits von 1,5× IQR.

Diese eine Box codiert die mittlere Hälfte der Daten, ihr Zentrum und die verdächtigen Werte an den Rändern — ein kompakter Ersatz für ein Histogramm, wenn Streuung und Extrema zählen.`,
    },
    'plot-heatmap': {
      name: 'Heatmap',
      brief: 'Baue `rows`, `cols` und eine `matrix` (list von lists), dann `heatmap(rows, cols, matrix)`. Eine heatmap färbt ein Netz an Werten, damit hohe/niedrige Werte auffallen.',
      learning: ['`heatmap(rows, cols, matrix)` färbt ein Netz nach Wert', 'Die matrix ist eine list von lists — eine innere list pro Zeile'],
      fieldNotes: ['matplotlib `plt.imshow` / seaborn `sns.heatmap`', 'Korrelations-Heatmaps nutzen dieselben Merkmale für Zeilen und Spalten'],
      lesson: `Eine **heatmap** beantwortet „wo in diesem Netz sind die Werte hoch oder niedrig?". Sie ist das einzige Diagramm hier, das eine **Matrix** nimmt — eine *list von lists*, eine innere list pro Zeile — plus die Zeilen- und Spaltenlabels. Jede Zelle wird nach ihrem Wert eingefärbt, damit Gipfel und Täler sofort lesbar sind.

So werden Korrelationstabellen gezeichnet: Zeilen und Spalten sind dasselbe Merkmal-Set, und jede Zelle ist die Korrelation eines Paares. Starke Farbe = starke Beziehung.`,
    },
    'plot-regression': {
      name: 'Regressionslinie',
      brief: 'Baue zwei abgestimmte Serien `xs` und `ys`, dann `reg(xs, ys)`. Eine Regression passt die kleinste-Quadrate-Linie durch das scatter — der Trend, dem die Punkte folgen.',
      learning: ['`reg(xs, ys)` passt die kleinste-Quadrate-Linie an ein scatter', 'Die Steigung ist die Änderungsrate des Trends; der y-Abschnitt sein Startwert'],
      fieldNotes: ['seaborn: `sns.regplot` / `sns.lmplot`', 'Ein Linienfit geht von einer linearen Beziehung aus — prüfe zuerst das scatter'],
      lesson: `Eine **Regression** beantwortet „gibt es einen geradlinigen Trend, und was ist er?". \`reg(xs, ys)\` berechnet die **kleinste-Quadrate**-Steigung und den y-Abschnitt im Engine und zeichnet die angepasste Linie durch deine scatter-Punkte — die Linie, die die Gesamtkarst zum Quadrat der Distanz zu den Punkten minimiert.

Das ist die Zusammenhangsfrage einen Schritt über \`scatter\`: Du siehst nicht nur, dass die Punkte einen Trend haben, du bekommst die *Gleichung* des Trends. Die Steigung ist die Änderungsrate, der y-Abschnitt der Punkt, wo die Linie die Achse kreuzt.`,
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
