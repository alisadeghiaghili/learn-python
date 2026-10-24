import type { LevelGroup } from './types';

export const deG2: LevelGroup = {
  seriesTitles: {
    names: 'Namen & Bindungen',
    containers: 'Container im Speicher',
    mutation: 'Mutation & Methoden',
    aliasing: 'Aliasing & Kopieren',
  },
  deepLessons: {},
  levels: {
    'first-name': {
      name: 'Der erste Name',
      brief: 'Bindet den Namen `x` an die Ganzzahl 3. Ein Name ist ein Etikett, das auf ein Objekt zeigt; das Canvas zeichnet kleine Zahlen direkt beim Namen, um das Bild übersichtlich zu halten.',
      learning: [
        'Ein Name lebt im Stack-Frame, nicht im Heap',
        'Jeder Name zeigt auf ein Objekt; das Canvas zeichnet kleine ints inline, damit das Bild lesbar bleibt',
      ],
      fieldNotes: [
        'Namensbindung ist O(1) — ein einziger Tabellenzugriff',
        'Python-Namen sind Groß-/Kleinschreibung-empfindlich: `X` und `x` sind unterschiedlich',
      ],
      lesson: `Ein *Name* ist ein Etikett, das auf ein Objekt zeigt. \`x = 3\` schreibt den Namen \`x\` in den aktuellen Stack-Frame und lässt ihn auf die Ganzzahl 3 zeigen.

In echtem Python ist auch 3 ein Objekt (probiere \`id(x)\`). Dieses Canvas zeichnet kleine unveränderliche Werte wie Ganzzahlen **direkt im Frame**, anstatt als Heap-Boxen. Das ist eine vereinfachte Darstellung, keine Behauptung, dass Zahlen keine Objekte seien. Der Name ist kein kleines Kästchen, das die Zahl enthält, sondern ein Etikett auf der Zahl selbst.`,
    },
    rebind: {
      name: 'Neu binden',
      brief: 'Bindet `x` an 1 und bindet `x` dann neu an 2. Der Name zeigt einfach irgendwoanders hin — es gibt kein „Feld“, das bearbeitet würde.',
      learning: [
        'Neubinden verschiebt den Namen; es editiert kein Feld',
        'Der alte Wert ist weg, es sei denn, ein anderer Name zeigt noch auf ihn',
      ],
      fieldNotes: [
        'Nützlich für Zähler und Akkumulatoren: `n = 0` und dann `n = n + 1`',
        'Neu binden innerhalb einer Funktion ist lokal auf diese Funktion beschränkt (siehe S5)',
      ],
      lesson: `Einem schon benutzten Namen zuzuweisen *aktualisiert* nichts — es **bindet** den Namen neu an einen neuen Wert. Nach \`x = 2\` zeigt der Name \`x\` nicht mehr auf 1.

Deshalb ist „Variablen“ ein etwas irreführendes Wort: Es ist der Name, der sich ändert, nicht eine feste Stelle.`,
    },
    'a-real-object': {
      name: 'Ein echtes Objekt',
      brief: 'Bindet `xs` an die Liste `[1, 2, 3]`. Listen sind Heap-Objekte — der Name `xs` hält eine *Referenz*, nicht die Liste selbst.',
      learning: [
        'Veränderbare Container sind Heap-Objekte',
        'Ein Name hält eine Referenz (einen Pfeil), nicht das Objekt',
      ],
      fieldNotes: [
        'Heap-Objekte haben eine Identität — `id()` macht sie sichtbar',
        'Zwei Namen können auf dasselbe Objekt zeigen (nächste Serie)',
      ],
      lesson: `Jetzt baust du etwas Veränderbares. \`xs = [1, 2, 3]\` alloziert ein **List-Objekt im Heap** und macht den Namen \`xs\` zu einer Referenz darauf.

Schau auf das Canvas: Der Frame zeigt \`xs\` mit einem kleinen Pfeil auf eine teal Box im Heap. Die Box enthält die Liste; der Name zeigt nur auf sie. Diese Trennung ist der Kern des Speichermodells.`,
    },
    'values-vs-refs': {
      name: 'Unveränderlich vs. veränderbar',
      brief: 'Halte in einem Frame sowohl ein unveränderliches int als auch eine veränderbare Liste: `x` ist 3, `xs` ist `[1, 2]`. Vergleiche, wie das Canvas sie darstellt.',
      learning: [
        'Jeder Name hält eine Referenz; der Unterschied ist, ob sich das Objekt in-place ändern kann',
        'Das Canvas zeichnet unveränderliche ints inline und veränderbare Listen als Heap-Boxen',
      ],
      fieldNotes: [
        'Veränderbar vs. unveränderlich entscheidet darüber, ob das Teilen eines Objekts riskant ist',
        'Strings sind wie ints unveränderliche Objekte',
      ],
      lesson: `Lege beide Arten von Objekten in einen Frame. Beide Namen sind Referenzen: \`x\` zeigt auf das int 3, \`xs\` zeigt auf eine Liste.

Der entscheidende Unterschied ist die **Veränderbarkeit (Mutability)**. Ein int kann sich niemals in-place ändern; daher zeichnet das Canvas es inline neben seinem Namen, und nichts geht verloren. Eine Liste kann sich in-place ändern und bekommt daher ihre eigene Box auf dem Heap: So siehst du, wenn mehrere Namen dieselbe Liste teilen. Wenn du einen Namen kopierst, kopierst du immer den Pfeil. Bei einem unveränderlichen Objekt ist das harmlos; bei einem veränderbaren ist es die Ursache für Aliasing-Fehler.`,
    },
    'shared-value': {
      name: 'Zwei Namen, ein Wert',
      brief: 'Bindet `a = 3`, dann `b = a`. Beide Namen zeigen nun auf dasselbe int-Objekt. Da sich ein int niemals in-place ändern kann, ist das Teilen völlig harmlos.',
      learning: [
        '`b = a` teilt immer das Objekt; es kopiert niemals',
        'Ein unveränderliches Objekt zu teilen ist harmlos: es kann sich nicht unter dir verändern',
      ],
      fieldNotes: [
        'Deshalb kannst du ein int bedenkenlos „neu binden“ ohne Seiteneffekte',
        'Unveränderliche Werte machen Defaults in Funktions-Signaturen sicher',
      ],
      lesson: `\`b = a\` kopiert niemals etwas: es lässt \`b\` auf dasselbe Objekt zeigen wie \`a\`. Hier ist dieses Objekt das int 3, also referenzieren beide Namen darauf (das Level \`identity-is\` zeigt, wie man dies mit \`is\` prüft).

Das ist dieselbe Regel wie bei einer Liste in der nächsten Serie. Der Unterschied ist, dass ein int nicht in-place geändert werden kann, sodass das Teilen dich niemals überrascht. Das Canvas zeigt nur deshalb keine geteilte Box, weil es kleine ints inline darstellt.`,
    },
    'list-update-in-place': {
      name: 'List in-place aktualisieren',
      brief: 'Bindet `xs` an `[1, 2]` und setzt Index 0 auf 9, damit die Liste `[9, 2]` wird — dasselbe Objekt, neuer Inhalt.',
      learning: [
        'Index-Zuweisung mutiert den Container in-place',
        'Die Objektidentität bleibt bei In-place-Änderungen erhalten',
      ],
      fieldNotes: [
        'In-place-Operationen machen `for`-Loops über Listen effizient',
        'Vorsicht beim Mutieren einer Liste, über die gerade iteriert wird',
      ],
      lesson: `\`xs[0] = 9\` editiert die Liste **in-place** — dasselbe Heap-Objekt enthält jetzt ein anderes erstes Element. Kein neues Objekt, keine Neubindung; die amber Kanten bleiben unverändert, der Inhalt der Box hat sich geändert.

Index-Zuweisung mutiert den benannten Container — genau das, was man für In-place-Updates erwartet.`,
    },
    'dict-entry': {
      name: 'Dict-Eintrag',
      brief: 'Erstelle `d = {"lang": "Python"}` und füge dann den Key `"level"` mit dem Wert `1` hinzu. Keys und Werte leben beide im Heap-Objekt.',
      learning: [
        'Ein dict ist ein einzelnes Heap-Objekt aus Key/Wert-Paaren',
        'Einen neuen Key zu setzen mutiert das dict in-place',
      ],
      fieldNotes: [
        '`dict`-Zugriff ist amortisiert O(1) über eine Hash-Tabelle',
        'Keys müssen hashbar sein — unhashbare Listen können keine Keys sein',
      ],
      lesson: `Ein Dictionary ist ein einzelnes Heap-Objekt, das **Key → Wert-Paare** enthält. \`d["level"] = 1\` fügt ein neues Paar in die bestehende Box ein, statt \`d\` neu zu binden.

Keys sind Teil des Objekts; einen komplett neuen Key zu setzen vergrößert das Objekt in-place. Der Name \`d\` zeigt auf dieselbe Box wie vorher.`,
    },
    'tuple-identity': {
      name: 'Tuple-Identität',
      brief: 'Erstelle das Tuple `t = (1, 2)` und binde `u = t`. Es müssen dasselbe Objekt sein — Tuples sind unveränderlich und identitätsstabil.',
      learning: [
        'Tuples sind unveränderlich, daher ist Aliasing sicher',
        'Unveränderliche Objekte können als dict-Keys verwendet werden',
      ],
      fieldNotes: [
        'Nutze Tuples für feste Datensätze (z. B. ein Koordinatenpaar)',
        'Named Tuples fügen einfachen Tuples lesbare Feldnamen hinzu',
      ],
      lesson: `Tuples sind unveränderlich, daher ist es immer sicher, sie zu aliasen: Es gibt keine In-place-Änderung, die versehentlich geteilt werden könnte. \`u = t\` bindet \`u\` an dasselbe Tuple-Objekt.

Da Tuples sich nicht ändern können, kannst du sie frei herumreichen und sogar als Dictionary-Keys verwenden — etwas, das veränderbare Lists nicht können.`,
    },
    'set-semantics': {
      name: 'Set-Semantik',
      brief: 'Baue das Set `s = {1, 2, 2, 3}`. Sets speichern nur eindeutige Werte, daher verschwindet das doppelte 2.',
      learning: [
        'Sets halten nur eindeutige Werte',
        'Ein Set ist wie eine List oder ein dict ein Heap-Objekt',
      ],
      fieldNotes: [
        '`set(a) | set(b)` vereinigt zwei Sammlungen',
        'Leere Sets müssen als `set()` geschrieben werden, nicht `{}` (das ist ein leeres dict)',
      ],
      lesson: `Ein Set-Literal sieht wie ein dict aus, hat aber keine \`:\. \`s = {1, 2, 2, 3}\` alloziert ein **Set**-Heap-Objekt, das nur die *eindeutigen* Werte enthält: das wiederholte \`2\` wird zu einem einzigen.

Sets eignen sich hervorragend für „Mitgliedschafts“-Fragen — \`x in s\` — und zum Deduplizieren einer Liste mit \`set(my_list)\`.`,
    },
    'grow-with-append': {
      name: 'Mit append vergrößern',
      brief: 'Bindet `a = [1]` und vergrößert sie mit `a.append(2)` zu `[1, 2]`. Das Objekt bleibt dasselbe, nur länger.',
      learning: [
        '`.append()` mutiert in-place und gibt None zurück',
        'In-place-Methoden erhalten die Objektidentität',
      ],
      fieldNotes: [
        'Nutze in einer Schleife lieber `append` als `a = a + [x]` (O(1) vs. O(n))',
        '`.extend()` hängt viele Elemente auf einmal an',
      ],
      lesson: `Methoden wie \`append\` mutieren das Objekt in-place und geben \`None\` zurück. Der Name \`a\` zeigt weiterhin auf dieselbe Liste — sie ist nur länger geworden.

Das unterscheidet sich von \`a = a + [2]\`, das eine *neue* Liste bauen und \`a\` neu binden würde. Append editiert; Konkatenation bindet neu.`,
    },
    'pop-returns': {
      name: 'Pop gibt zurück',
      brief: 'Bindet `a = [1, 2]`, dann `last = a.pop()`. `pop` entfernt das letzte Element *und* gibt es zurück — `last` sollte 2 sein.',
      learning: [
        '`.pop()` mutiert die Liste und gibt das entfernte Element zurück',
        'Der Rückgabewert kann an einen neuen Namen gebunden werden',
      ],
      fieldNotes: [
        '`pop` ist so, wie du einen Stack implementierst: `push = append`, `pop = pop`',
        'Pop vom Ende ist O(1); vom Anfang ist O(n)',
      ],
      lesson: `Anders als \`append\` hat \`pop\` einen **Rückgabewert**: das Element, das es entfernt hat. Nach \`last = a.pop()\` schrumpft die Liste auf \`[1]\` und \`last\` enthält das entfernte \`2\`.

„Mutieren und zurückgeben“ ist ein häufiges Muster — dieselbe Liste wird bearbeitet, während gleichzeitig ein nützlicher Wert entsteht.`,
    },
    'dict-get-safe': {
      name: 'Sicheres dict-get',
      brief: 'Mit `d = {"a": 1}` liest du einen fehlenden Key sicher aus: `v = d.get("b", 0)`. `get` gibt den Standardwert zurück, statt eine Ausnahme zu werfen.',
      learning: [
        '`.get(key, default)` gibt einen Standardwert zurück, statt eine Ausnahme zu werfen',
        'Optionale Keys auszulesen ist ein häufiges Muster aus der Praxis',
      ],
      fieldNotes: [
        '`dict.setdefault` setzt bei einem Miss den Standardwert — ein nützlicher Nebeneffekt',
        'Vermeide `try/except KeyError`, wenn `get` die Absicht besser ausdrückt',
      ],
      lesson: `\`d["b"]\` würde bei einem fehlenden Key \`KeyError\` werfen. \`d.get("b", 0)\` gibt dagegen den **Standardwert** \`0\` zurück, wenn der Key nicht existiert.

Das macht \`get\` zum idiomatischen Weg, optionale Einträge zu lesen, ohne jeden Zugriff in \`try\`/\`except\` einzwickeln.`,
    },
    'dict-update-merge': {
      name: 'Dict update / merge',
      brief: 'Mit `d = {"a": 1}` fügst du weitere Paare per `d.update({"b": 2})` hinzu, sodass `d` zu `{"a": 1, "b": 2}` wird.',
      learning: [
        '`.update()` merged ein anderes dict in-place hinein',
        'Bestehende Keys werden überschrieben; neue Keys werden hinzugefügt',
      ],
      fieldNotes: [
        '`defaults.update(user_config)` ist ein Standard-Config-Muster',
        'Der `|`-Merge-Operator baut stattdessen ein *neues* dict, statt zu mutieren',
      ],
      lesson: `\`update\` merged eine andere Mapping in \`d\` **in-place**: Übereinstimmende Keys werden überschrieben, neue Keys werden hinzugefügt. Der Name \`d\` zeigt weiterhin auf dasselbe dict.

Das ist die Grundlage von Konfigurations-Layering — mit Defaults starten und dann mit \`update\` User-Overrides darüberlegen.`,
    },
    'two-names-one-list': {
      name: 'Zwei Namen, eine List',
      brief: 'Erstelle `a = [1]` und `b = a`, sodass beide Namen auf dieselbe Liste zeigen. Füge dann über `a` die 2 an. `b` muss es sehen.',
      learning: [
        '`b = a` teilt das Objekt; es kopiert es nicht',
        'Änderungen über einen Alias sind über alle Aliasse sichtbar',
      ],
      fieldNotes: [
        'Deshalb sind Standard-`list`-Argumente eine Falle',
        'Erkenne Aliasing in Produktion mit `id(a) == id(b)`',
      ],
      lesson: `Das ist der klassische Python-Fallstrick. \`b = a\` kopiert die Liste **nicht** — es bindet \`b\` an dasselbe Objekt, auf das \`a\` zeigt. Zwei amber Kanten führen jetzt auf dieselbe teal Box.

Wenn du \`a.append(2)\` aufrufst, mutierst du das geteilte Objekt, daher sieht auch \`b\` \`[1, 2]\`. Aliasing ist die häufigste Ursache für überraschende Mutationen.`,
    },
    'copy-dont-alias': {
      name: 'Kopieren, nicht aliasen',
      brief: 'Erstelle `a = [1]`. Binde `b` mit `.copy()` an eine *neue* Liste mit demselben Inhalt. `a` und `b` müssen verschiedene Objekte sein.',
      learning: [
        '`.copy()` erstellt eine oberflächliche, unabhängige Kopie des Containers',
        'Eine oberflächliche Kopie kopiert die Referenzen auf verschachtelte Objekte, nicht die Objekte selbst',
      ],
      fieldNotes: [
        '`copy.deepcopy` existiert für vollständig unabhängige verschachtelte Strukturen',
        'Greife zu `.copy()`, bevor du eine Liste mutierst, die dir nicht gehört',
      ],
      lesson: `Manchmal willst du denselben *Inhalt*, aber ein separates Objekt. \`b = a.copy()\` alloziert eine **neue** Liste mit denselben Elementen.

Jetzt zeigen \`a\` und \`b\` auf zwei verschiedene Heap-Boxen. Das Mutieren der einen betrifft die andere nicht mehr. \`.copy()\` ist eine oberflächliche Kopie — verschachtelte Objekte innerhalb werden weiterhin geteilt (eine Nuance, die du später zu spüren bekommst).`,
    },
    'rebind-vs-mutate': {
      name: 'Neu binden vs. mutieren',
      brief: 'Beginne mit `a = [1]` und `b = a`. Binde `a` neu an eine neue Liste `[9]`. `b` muss weiterhin die alte Liste `[1]` sein.',
      learning: [
        'Einen Namen neu zu binden betrifft andere Namen auf demselben Objekt nicht',
        'Mutieren betrifft alle Aliasse; Neubinden nicht',
      ],
      fieldNotes: [
        'Diese beiden zu verwechseln ist die Ursache vieler „Warum hat sich meine Liste geändert?“-Bugs',
        'Linter und Typperchecker stoppen dich nicht — das Speichermodell schon',
      ],
      lesson: `Es gibt zwei sehr unterschiedliche Dinge, die du tun kannst: Das Objekt **mutieren** oder den Namen **neu binden**.

Hier bindet \`a = [9]\` \`a\` an eine *neue* Liste neu. Das alte \`[1]\` bleibt unangetastet, und \`b\` — das immer noch darauf zeigt — zeigt weiter auf \`[1]\`. Die zwei Namen haben sich getrennt. Mutation editiert in-place; Neubinden verschiebt nur ein Etikett.`,
    },
    'identity-is': {
      name: 'Identität: `is`',
      brief: 'Bindet `a = [1]` und `b = a` und berechnet dann `ok = a is b`. `is` prüft, ob zwei Namen dasselbe Objekt sind.',
      learning: [
        '`is` vergleicht die Objektidentität, `==` den Wert',
        'Zwei aliasede Namen sind per `is` dasselbe Objekt',
      ],
      fieldNotes: [
        '`is None` ist idiomatisch, weil `None` ein Singleton ist',
        'Nutze `is` nie für Zahlen-Gleichheit — dafür ist `==`',
      ],
      lesson: `Der \`is\`-Operator stellt eine schärfere Frage als \`==\$: Sind das **dasselbe Objekt**, oder nur gleich? Da \`b = a\` ist, halten beide Namen dieselbe Heap-Id, daher ist \`a is b\` \`True\`.

Nutze \`==\`, um *Werte* zu vergleichen, und \`is\`, um *Identität* zu vergleichen. Bei Container-Objekten weichen die zwei wirklich voneinander ab: Zwei Lists können \`==\` sein, ohne \`is\` zu sein.`,
    },
  },
};
