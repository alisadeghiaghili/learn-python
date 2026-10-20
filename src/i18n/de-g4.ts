import type { LevelGroup } from './types';

export const deG4: LevelGroup = {
  seriesTitles: {
    numpy: 'NumPy: Puffer & Ansichten',
    pandas: 'Pandas: Tabellen als Fenster über einen Puffer',
  },
  deepLessons: {
    numpy: `## Beginner

Ein numpy-Array ist wie ein **Rahmen**, der über eine Reihe von Perlen gleitet.
Die Perlen (die Zahlen) liegen in einer langen, ununterbrochenen Reihe — diese
Reihe ist der **Puffer**. Der Rahmen ist das **Array**: Er sagt nur „fang hier
an und zeig diese Anzahl von Perlen." Wenn du einen Slice nimmst, kopierst du
keine Perlen; du machst einfach einen *kleineren Rahmen* über **derselben**
Reihe. Wenn du kopierst, gießt du die Perlen in eine völlig neue Reihe.

\`\`\`schematic
{
  "id": "numpy-view-vs-copy",
  "title": "A window over a buffer — view vs copy",
  "nodes": [
    {
      "id": "a",
      "label": "a",
      "sub": "ndarray · own"
    },
    {
      "id": "v",
      "label": "v = a[:2]",
      "sub": "ndarray · view"
    },
    {
      "id": "c",
      "label": "b = a.copy()",
      "sub": "ndarray · own"
    },
    {
      "id": "bufA",
      "label": "buffer A",
      "sub": "float64[3]",
      "type": "buffer"
    },
    {
      "id": "bufB",
      "label": "buffer B",
      "sub": "float64[2]",
      "type": "buffer"
    }
  ],
  "edges": [
    {
      "from": "a",
      "to": "bufA",
      "label": "owns"
    },
    {
      "from": "v",
      "to": "bufA",
      "label": "same buffer",
      "dashed": true
    },
    {
      "from": "c",
      "to": "bufB",
      "label": "owns (new)"
    }
  ],
  "legend": [
    {
      "color": "amber",
      "label": "points at / owns"
    },
    {
      "color": "coral",
      "label": "shares the buffer"
    }
  ]
}
\`\`\`

## Intermediate

Zwei Objekte, immer. \`np.array([1, 2, 3])\` alloziert einen **Puffer** (eine
flache, zusammenhängende Kette roher Zahlen) und ein **ndarray** — ein
*Fenster* (ein Offset plus eine Länge), das sagt, welcher Teil dieses Puffers
angezeigt werden soll. Der Name \`a\` zeigt auf das Fenster; das Fenster zeigt
auf den Puffer.

- \`a.copy()\` liest \`a\`s Puffer und prägt einen **zweiten** Puffer mit denselben
  Zahlen. Zwei Fenster, zwei Puffer — Änderungen an dem einen sind für das
  andere unsichtbar.
- \`a[:2]\` macht eine **Ansicht** (view): ein zweites Fenster über *demselben*
  Puffer. Keine Daten werden bewegt; nur Offset und Länge ändern sich.
- Weil eine Ansicht ihren Puffer teilt, schreibt \`v[0] = 9\` in dieselbe
  geteilte Kette, und \`a\` sieht die Änderung. Eine Kopie, nie.

## Advanced

Das mentale Modell, das im echten Code zählt: **ein Slice ist eine Ansicht,
keine Kopie.** Das ist der häufigste numpy-Fallstrick.

- Ein Slice \`a[i:j]\` ist O(1) — er alloziert ein neues Fenster, bewegt keine
  Daten und teilt den Puffer. Das \`base\`-Attribut des Ergebnisses zeigt auf
  das ursprüngliche Objekt zurück.
- Jede Operation, die *neue Daten baut* (eine elementweise Operation wie
  \`a + 1\`, ein fancy index, \`a.copy()\`) alloziert einen **frischen** Puffer.
- Also die Frage, die du dir immer stellen solltest: *Teilt dieser Ausdruck
  meine Daten, oder macht er neue?* Ansichten ketteln ist umsonst; Ketten
  echter Operationen ist, wo du Speicher bezahlst.

## Expert

Die Speicher-Mechanik, präzise.

- Ein Puffer ist eine zusammenhängende \`float64\`-Kette. Ein ndarray speichert
  \`{buffer, offset, shape, dtype, view}\`. Zwei ndarrays sind „dieselben
  Daten", genau dann, wenn sie auf dieselbe Puffer-Box zeigen — genau das, was
  die gemeinsame Fenster-Schiene in der RAM-Ansicht zeigt.
- Elementweise Operationen sind vektorisiert: \`a + 1\` liest \`a\`s Fenster und
  schreibt einen neuen Puffer. Verkettete Ausdrücke allozieren pro Schritt
  einen Zwischen-Puffer — die Kosten, die du in einer heißen Schleife im Auge
  behalten musst.
- \`a.sum()\` ist eine Reduktion über das Fenster: ein Durchlauf, ein Skalar
  heraus, kein neuer Puffer.
- Schau auf den RAM-Tab, während du das machst: Die Adressen sind monoton, die
  Puffer-Zeile zeigt ihre rohen Byte-Zellen, und jede Ansicht malt ihr
  \`[offset..offset+shape)\`-Fenster als Schiene, ausgerichtet mit diesen
  Zellen.

## Master

Wo dieses Modell sich auszahlt und wo es zusammenbricht.

- **Strides & Broadcast**: Echte ndarrays tragen ein Stride, sodass ein
  nicht-zusammenhängender Slice noch immer eine Ansicht ist (ein Fenster mit
  einem Stride ungleich 1). Dieser Visualizer hält ein flaches 1-D-Fenster, um
  über den Puffer ehrlich zu bleiben, und sagt das in den Lektionen.
- **\`base\` / \`.copy()\`-Vertrag**: In Produktion ist \`arr.base\` der
  kanonische „besitzt diese Ansicht ihre Daten"-Check; \`copy(arr)\` und
  \`arr.copy()\` sind die Ausweichoption. Eine Ansicht, die länger lebt als
  ihr Puffer, ist die klassische Speicher-Sicherheits-Falle.
- **Performance**: Bevorzuge In-place-Operationen und Ansichten, wenn du die
  Unabhängigkeit nicht brauchst, und \`np.ascontiguousarray\` vor einem Aufruf,
  der Zusammenhang will. Das Identitätsbild — geteilter vs. eigener Puffer —
  ist die ganze Entscheidung: Kopiere nur, wenn du die Daten besitzen musst.
`,
    pandas: `## Beginner

Eine pandas-Tabelle ist wie ein **Raster von Perlen**. Alle Zahlen werden in
eine lange, ununterbrochene Reihe (den **Puffer**) gegossen — die Perlen von
Spalte 1, dann Spalte 2, der Reihe nach, Zeile für Zeile. Die Tabelle (ein
**DataFrame**) ist ein *Rahmen*, der sagt „dies sind die Spalten, dies sind
die Zeilen." Wenn du einen Zeilen-Slice mit \`iloc\` nimmst, kopierst du keine
Perlen neu; du schiebst einfach einen *kleineren Rahmen* über **dieselbe**
Reihe. Wenn du kopierst, gießt du die Perlen in eine völlig neue Reihe.

\`\`\`schematic
{
  "id": "pandas-view-vs-copy",
  "title": "A DataFrame window over one buffer",
  "nodes": [
    {
      "id": "df",
      "label": "df",
      "sub": "DataFrame · own"
    },
    {
      "id": "v",
      "label": "v = df.iloc[1:3]",
      "sub": "DataFrame · view"
    },
    {
      "id": "c",
      "label": "c = df.copy()",
      "sub": "DataFrame · own"
    },
    {
      "id": "buf",
      "label": "buffer",
      "sub": "row-major [x, y, …]",
      "type": "buffer"
    },
    {
      "id": "buf2",
      "label": "buffer B",
      "sub": "fresh copy",
      "type": "buffer"
    }
  ],
  "edges": [
    {
      "from": "df",
      "to": "buf",
      "label": "owns"
    },
    {
      "from": "v",
      "to": "buf",
      "label": "row window · shared",
      "dashed": true
    },
    {
      "from": "c",
      "to": "buf2",
      "label": "owns (new)"
    }
  ],
  "legend": [
    {
      "color": "amber",
      "label": "points at / owns"
    },
    {
      "color": "coral",
      "label": "shares the buffer"
    }
  ]
}
\`\`\`

## Intermediate

Ein **DataFrame** ist ein Fenster über einen Puffer, gespeichert row-major:
die Zellen von Zeile 0, dann die Zellen von Zeile 1, und so weiter. Ein
**Series** ist der 1-D-Fall — eine Spalte, ihr eigener Puffer plus eine Liste
von Zeilen-Labels.

- \`pd.DataFrame({"x": [1, 2], "y": [3, 4]})\` gießt die Zeilen in einen Puffer
  \`[1, 3, 2, 4]\` und wickelt ihn mit Spaltennamen und einem Index ein.
- \`df["x"]\` liest eine Spalte als **Series** heraus.
- \`df.iloc[1:3]\` ist eine **Ansicht**: ein zweites Fenster über *demselben*
  Puffer, nur über einem Zeilenbereich. Keine Daten werden kopiert.
- Weil eine Ansicht ihren Puffer teilt, ändert ein Schreiben über \`v\` auch
  \`df\`.

## Advanced

Das mentale Modell, das zählt: **\`loc\`/\`iloc\` sind Ansichten, keine
Kopien.** Das ist die pandas-Identitäts-Idee, und es ist exakt die numpy-
Lektion, auf eine Tabelle gehoben.

- \`df.iloc[a:b]\` macht ein Fenster über einem Zeilenbereich — die Daten
  werden nicht bewegt. Der Puffer des Slices **ist** der Puffer des Frames.
- \`df.copy()\` liest das Fenster und prägt einen **neuen** Puffer. Zwei
  Frames, zwei Puffer — Änderungen an dem einen sind für das andere
  unsichtbar.
- \`df["col"] = [...]\` schreibt *in* den geteilten Puffer, sodass jedes
  Fenster über ihm die Änderung sieht.
- Also die ständige Frage: *Teilt dieser Ausdruck die Daten meines Frames,
  oder macht er neue?* Slicen ist umsonst; eine Kopie ist, wo du bezahlst.

## Expert

Die Mechanik, präzise.

- Ein DataFrame speichert \`{buffer, columns, index, dtype, view, rowOffset}\`.
  Ein Zeilen-Slice wieder verwendet \`buffer\` und rückt \`rowOffset\` vor;
  eine Kopie prägt einen neuen Puffer mit \`rowOffset\` 0 und \`view: false\`.
- „Dieselben Daten" heißt „dieselbe Puffer-Box" — genau das zeigt die
  RAM-Ansicht (der Frame und seine Ansicht zeigen auf einen Puffer; eine
  Kopie auf einen zweiten).
- \`df.sum()\` reduziert jede Spalte zu einer Series; \`df["col"]\` liest eine
  Spalte als Series. Beide *bauen* Objekte über einem (neuen oder
  einzel-spaltigen) Puffer.
- Schau auf den RAM-Tab: Die Puffer-Zeile zeigt die row-major-Byte-Zellen,
  und eine Ansicht ist ein Fenster über dieser geteilten Kette.

## Master

Wo es sich auszahlt und wo es zusammenbricht.

- **Copy-on-write**: Modernes pandas bewegt sich Richtung Copy-on-write, wo
  eine Ansicht nur *so tut*, als würde sie teilen, bis du schreibst, worauf
  hin sie kopiert. Dieser Visualizer lehrt die klassische, sofortige Ansicht
  (eager view), damit das Puffer-Teilen explizit bleibt.
- **Loc vs. iloc**: \`loc\` ist labelbasiert, \`iloc\` positionbasiert — beide
  sind Ansichten; weder kopiert. Ein Schreiben über eine Ansicht mutiert den
  geteilten Puffer (der klassische Fallstrick), während das Zuweisen einer
  *neuen* Spalte neu bindet.
- **Speicher**: Ein großer Frame, der auf viele Arten gesliced ist, ist immer
  noch ein Puffer; eine Kette von \`.copy()\`-Aufrufen ist, wo die Zeilen
  dupliziert werden. Das Identitätsbild — geteilter vs. eigener Puffer — ist
  die ganze Entscheidung, genau wie bei numpy.
`,
  },
  levels: {
    'np-make-array': {
      name: 'Ein ndarray bauen',
      brief: 'Importiere numpy als `np` und baue `a = np.array([1, 2, 3])`. Ein ndarray ist ein *Fenster* über einer separaten **Puffer**-Box, die die rohen Zahlen hält — zwei Boxen, nicht eine.',
      lesson: `Im Speicher-Modell macht \`np.array([1, 2, 3])\` **zwei** Heap-Boxen. Die innere ist ein *Puffer* — eine flache Kette roher Zahlen \`[1, 2, 3]\`. Die äußere ist das **ndarray**: ein *Fenster* (Offset + shape), das sagt „zeige mir diesen Teil dieses Puffers."

Der Name \`a\` zeigt auf die ndarray-Box, die ihrerseits auf die Puffer-Box zeigt. Diese Trennung — die Ansicht über den rohen Daten — ist die ganze Idee, auf der numpy aufgebaut ist, und genau sie macht Ansichten und Kopien möglich.`,
      learning: ['Ein ndarray ist ein Fenster über einem separaten Puffer', 'Der Name zeigt auf das Fenster, nicht auf die rohen Zahlen'],
      fieldNotes: ['Der Puffer ist zusammenhängender C-Speicher; das Fenster fügt shape und stride hinzu', 'dtype ist pro Puffer fest — hier `float64`'],
    },
    'np-copy': {
      name: 'Eine unabhängige Kopie',
      brief: 'Kopiere `a` mit `.copy()` in `b`. `b` muss seinen **eigenen** Puffer bekommen — zwei Namen, zwei Fenster, zwei *separate* Puffer.',
      lesson: `\`a.copy()\` macht echte Arbeit: Es liest \`a\`s Puffer und prägt einen **ganz neuen** Puffer mit denselben Zahlen, und wickelt ihn in ein frisches Fenster. Jetzt sind \`a\` und \`b\` zwei Fenster über **zwei verschiedenen** Puffern.

Schau auf das Canvas: zwei ndarray-Boxen, jede mit ihrer eigenen amber Kante zu einer *anderen* Puffer-Box. Weil die Puffer getrennt sind, ist eine Änderung an dem einen für das andere unsichtbar. Das ist der „sichere" Weg, ein Array von einem geteilten zu trennen.`,
      learning: ['`.copy()` alloziert einen neuen Puffer, nicht nur ein neues Fenster', 'Unabhängige Puffer heißen: keine geteilte Mutation'],
      fieldNotes: ['Kopieren ist O(n) — es liest jedes Element in neuen Speicher', 'Greife zu `.copy()`, bevor du ein Array mutierst, das dir nicht gehört'],
    },
    'np-view-slice': {
      name: 'Ein Slice ist eine Ansicht',
      brief: 'Slice `a[:2]` in `v`. Ein numpy-Slice ist KEINE Kopie — er ist eine **Ansicht**: ein zweites Fenster über *demselben* Puffer, den `a` schon benutzt.',
      lesson: `Das ist der Hauptdarsteller. \`a[:2]\` kopiert die ersten zwei Zahlen **nicht** in neuen Speicher. Es macht einfach ein **zweites Fenster** — „zeig mir die Elemente 0 bis 2" — das auf *dieselbe* Puffer zeigt, die \`a\` benutzt.

Auf dem Canvas siehst du jetzt zwei ndarray-Boxen (\`a\` und \`v\`) mit amber Kanten, die auf **eine** Puffer-Box zusammenlaufen. Das Tag unter \`v\` sagt \`view\`; das Tag unter \`a\` sagt \`own\`. Dieselben Daten, zwei Fenster — Slicen ist genau deshalb billig, weil es den Puffer teilt.`,
      learning: ['Ein Slice ist eine Ansicht, keine Kopie — er teilt den Puffer', 'Das `view`-Tag bedeutet „dieses Fenster ist nicht der ganze Puffer"'],
      fieldNotes: ['Slicen ist O(1): keine Daten werden bewegt, nur ein neues Offset + shape', 'Genau deshalb können Ansichten ein Fallstrick sein (nächste Stufe)'],
    },
    'np-view-mutates': {
      name: 'Der geteilte Puffer beißt',
      brief: '`v = a[:2]` ist eine Ansicht von `a`. Schreibe `v[0] = 9`. Weil `v` und `a` einen Puffer teilen, **ändert sich auch `a`** — du hast es nie angefasst.',
      lesson: `Hier ist, warum Ansichten wichtig sind. \`v\` ist nur ein Fenster über \`a\`s Puffer, also schreibt \`v[0] = 9\` **in den geteilten Puffer** an Position 0. Lies \`a\` erneut: Du siehst ein \`9\`, wo vorher das \`1\` war — \`a\` hat sich geändert, weil es und \`v\` zwei Ansichten über einem Puffer sind.

Das Canvas macht es unausweichlich: eine Puffer-Box, zwei Fenster, ein Schreiben, zwei Beobachter. Wenn du wolltest, dass \`v\` seine eigenen unabhängigen Daten hat, hättest du stattdessen \`a[:2].copy()\` gebraucht — eine Ansicht plus eine Kopie.`,
      learning: ['Ein Schreiben über eine Ansicht mutiert den geteilten Puffer', 'Jede Ansicht über diesem Puffer sieht die Änderung'],
      fieldNotes: ['`a[:]` (ein ganzer Slice) ist immer noch eine Ansicht — kopiere sie, wenn du nicht teilen darfst', 'numpy bietet `v.base`, um den Puffer zu finden, auf den eine Ansicht zeigt'],
    },
    'np-vector-capstone': {
      name: 'Capstone: vektorisieren + reduzieren',
      brief: 'Das numpy-Finale. `b = a + 1` ist *vektoriert* — es liest `a` und baut einen **neuen** Puffer `[2. 3. 4.]`. Dann `s = b.sum()` faltet diesen Puffer zu einem einzelnen Skalar zusammen.',
      lesson: `Der NumPy-Gewinn ist *Vektorisierung*: \`a + 1\` addiert 1 zu **jedem** Element in einem Ausdruck. Unter der Haube ist das genau die Speicher-Geschichte, die du gerade gelernt hast — es liest \`a\`s Puffer, baut einen **neuen** Puffer \`[2, 3, 4]\` und wickelt ihn in ein frisches Fenster \`b\`. Kein Element wird mit \`a\` geteilt.

Dann durchläuft \`b.sum()\` diesen Puffer einmal und faltet ihn in den Skalar \`9\` zusammen. Drei Ideen auf einmal: ein Fenster über einem Puffer, eine vektorisierte Operation, die einen neuen Puffer prägt, und eine Reduktion darüber. Das ist die Form von echtem numpy.`,
      learning: ['Eine vektorisierte Operation baut einen neuen Puffer aus dem Operanden', '`.sum()` reduziert einen Puffer zu einem Skalar'],
      fieldNotes: ['Elementweise Operationen allozieren immer einen neuen Ergebnis-Puffer', 'Verkettete Operationen allozieren Zwischen-Puffer — das sind die Kosten, die du in echtem Code im Auge behalten musst'],
    },
    'pd-make-series': {
      name: 'Ein Series bauen',
      brief: 'Importiere pandas als `pd` und baue `s = pd.Series([1, 2, 3])`. Ein Series ist eine Spalte: ein **Puffer** aus Zahlen plus ein Zeilen-Index.',
      lesson: `Ein **Series** ist der 1-D-Fall des numpy-Bilds: ein Fenster über einem **Puffer** roher Zahlen, plus ein Zeilen-Index, der die Positionen labelt. Der Name \`s\` zeigt auf die Series-Box, die ihrerseits auf ihre Puffer-Box zeigt. Zwei Boxen, eine Spalte.`,
      learning: ['Ein Series ist eine Spalte: ein Fenster über einem Puffer + ein Zeilen-Index', 'Der Name zeigt auf das Series, nicht auf die rohen Zahlen'],
      fieldNotes: ['dtype ist pro Puffer fest — hier `float64`', 'Der Index ist, was `loc` adressiert'],
    },
    'pd-make-frame': {
      name: 'Ein DataFrame bauen',
      brief: 'Baue `df = pd.DataFrame({"x": [1, 2], "y": [3, 4]})`. Die Zeilen werden in EINEN **Puffer** gegossen (row-major: `[1, 3, 2, 4]`), eingewickelt mit Spaltennamen und einem Index.',
      lesson: `Ein **DataFrame** ist ein Fenster über einem einzelnen **Puffer**, row-major angeordnet: die Zellen von Zeile 0, dann die von Zeile 1, und so weiter. \`{"x": [1, 2], "y": [3, 4]}\` wird zum Puffer \`[1, 3, 2, 4]\` — x dann y für Zeile 0, dann x dann y für Zeile 1 — eingewickelt mit den Spaltennamen \`x\`, \`y\` und einem Index.`,
      learning: ['Ein DataFrame ist ein Puffer (row-major) + Spalten + Index', 'Der Puffer ist [x0, y0, x1, y1, ...], nicht Spalte für Spalte'],
      fieldNotes: ['Spalten sind virtuelle Slices des row-major-Puffers', 'Genau deshalb wird eine einzelne Spalte als ihr eigenes Series herausgelesen'],
    },
    'pd-col-select': {
      name: 'Eine Spalte lesen',
      brief: 'Nimm `c = df["x"]`. Eine Spalte nach Namen auszuwählen liefert ein **Series** — die x-Werte, mit dem Index des Frames.',
      lesson: `Eine Spalte ist keine zusammenhängende Kette des row-major-Puffers — die x-Werte sind mit den y-Werten verflochten. Also liest \`df["x"]\` sie in ein **Series** mit ihrem eigenen einzel-spalrigen Puffer und dem Index des Frames. Eine Tabelle und eine Spalte sind zwei verschiedene Formen derselben Fenster-Idee.`,
      learning: ['Eine Spalte auszuwählen liefert ein Series', 'Eine Spalte ist aus dem row-major-Puffer herausgeschnitten'],
      fieldNotes: ['`df[["x", "y"]]` (eine Liste) liefert stattdessen ein Sub-DataFrame', 'Spaltenauswahl ist der Einstieg in Spalten-weises Rechnen'],
    },
    'pd-iloc-view': {
      name: 'Ein Zeilen-Slice ist eine Ansicht',
      brief: 'Slice `v = df.iloc[1:3]`. Ein `iloc`-Zeilen-Slice ist KEINE Kopie — er ist eine **Ansicht**: ein zweites Fenster über *demselben* Puffer, den `df` schon benutzt.',
      lesson: `Das ist der Hauptdarsteller. \`df.iloc[1:3]\` kopiert die Zeilen 1 und 2 **nicht** in neuen Speicher. Es macht ein **zweites Fenster** über *demselben* Puffer, vorgezogen auf Zeile 1. Die RAM-Ansicht macht es unausweichlich: \`df\` und \`v\` zeigen auf **eine** Puffer-Box; \`v\` ist nur ein Zeilenbereich davon. Ein Schreiben über \`v\` editiert den geteilten Puffer, also sieht es \`df\`. Eine Kopie wäre die Ausweichoption — nächste Stufe.`,
      learning: ['Ein `iloc`-Zeilen-Slice ist eine Ansicht, keine Kopie — er teilt den Puffer', 'Die Ansicht ist ein Fenster, vorgezogen auf einen Zeilen-Offset'],
      fieldNotes: ['`loc` ist der labelbasierte Zwillingsbruder von `iloc` — auch eine Ansicht', 'Genau deshalb kann `v = df[...]` in echtem Code `df` mutieren'],
    },
    'pd-copy-independent': {
      name: 'Capstone: Ansicht vs. Kopie',
      brief: 'Das pandas-Finale. `v = df.iloc[1:3]` ist eine *Ansicht*, die `df`s Puffer **teilt**; `c = df.copy()` ist *unabhängig* — sie besitzt einen **neuen** Puffer. Zeige den Kontrast.',
      lesson: `Der NumPy-Gewinn, als Tabelle. \`df.iloc[1:3]\` teilt \`df\`s Puffer (eine Ansicht — eine Box, zwei Fenster), während \`df.copy()\` einen **neuen** Puffer prägt. Drei Fakten auf einmal: \`df\` und \`v\` sind „dieselben Daten" (dieselbe Puffer-Box), und \`df\` und \`c\` sind es nicht (verschiedene Puffer). Diese geteilt-vs-eigen Unterscheidung ist das gesamte pandas-Speicher-Modell, und der RAM-Tab ist, wo du es sehen kannst: der Frame und seine Ansicht zielen auf einen Puffer, die Kopie auf einen zweiten.`,
      learning: ['Eine Ansicht teilt den Puffer; eine Kopie besitzt einen neuen', '„Dieselben Daten" heißt „dieselbe Puffer-Box"'],
      fieldNotes: ['Bevorzuge Ansichten, wenn du nur hinschauen musst; kopiere, wenn du die Zeilen besitzen musst', 'Verkettete `.copy()`-Aufrufe sind, wo ein großer Frame im Speicher dupliziert wird'],
    },
  },
};
