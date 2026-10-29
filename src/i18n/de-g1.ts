import type { LevelGroup } from './types';

export const deG1: LevelGroup = {
  seriesTitles: {
    basics: 'Erste Schritte',
    flow: 'Entscheidungen',
    loops: 'Wiederholen',
    functions: 'Funktionen & Frames',
  },
  deepLessons: {},
  levels: {
    'hello-world': {
      name: 'Erster Lauf: Das Terminal',
      brief: 'Klicke auf den grünen Run-Button (oder drücke Strg+Enter), um dein erstes Programm auszuführen und die Ausgabe im Terminal zu sehen.',
      lesson: `Willkommen bei **learn-python**!

Im Code-Editor schreibst du deine Anweisungen. Das Terminal darunter zeigt die Textausgabe deines Programms.

\`print( ... )\` zeigt, was in den Klammern steht. Setze Wörter in Anführungszeichen — sie sagen Python: „Das ist Text."

Klicke auf den grünen **Run**-Button (oder drücke **Strg+Enter**), um deine erste Ausgabezeile im Terminal zu sehen!`,
      learning: ['Ein Programm ist eine Liste von Zeilen, die Python in Reihenfolge ausführt', 'Text (Wörter) wird in Anführungszeichen geschrieben'],
      fieldNotes: ['`print` ist der schnellste Weg, zu prüfen, was dein Code tut', 'Anführungszeichen machen aus etwas einen String; ohne sie denkt Python, du meinst einen Namen'],
    },
    'first-variable': {
      name: 'Der Speicher: Deine erste Variable',
      brief: 'Speichere die Zahl 5 unter dem Namen score mit `score = 5`. Beobachte das Speicher-Board rechts!',
      lesson: `Das Zeichen \`=\` bedeutet nicht „gleich" wie in der Mathematik. Es bedeutet: **Gib diesem Namen einen Wert**.

\`score = 5\` hängt die Zahl 5 an den Namen \`score\`.

Sobald du diese Zeile ausführst, erscheint im Speicher-Board rechts auf dem Stack ein Kasten mit dem Namen \`score\`, der die Zahl 5 enthält.`,
      learning: ['`=` speichert einen Wert unter einem Namen', 'Danach steht der Name für diesen Wert'],
      fieldNotes: ['Namen sind in der Regel kleingeschrieben: `score`, `total`, `count`', 'Das Etikett zeigt auf den Wert — änderst du den Wert, gilt das Etikett weiter'],
    },
    'step-time-travel': {
      name: 'Zeitreise mit Step',
      brief: 'Führe den Code Zeile für Zeile mit dem Step-Button aus oder ziehe den Zeitschieberegler, um die Entwicklung der Variablen im Speicher zu verfolgen.',
      learning: [
        'Programme werden strikt Zeile für Zeile von oben nach unten ausgeführt',
        'Mit den Step-Buttons und dem Schieberegler kannst du zu jedem Zeitpunkt der Ausführung springen',
      ],
      fieldNotes: [
        'Das schrittweise Ausführen (Stepping) ist das wichtigste Werkzeug für Entwickler bei der Fehlersuche',
        'Das Memory-Board zeigt zu jedem Zeitschritt den exakten Speicherzustand',
      ],
      lesson: 'Python liest deinen Code Zeile für Zeile wie eine Geschichte. Mit dem **Step-Button** und dem Zeitschieberegler kannst du die Ausführung schrittweise vor- und zurückspulen und im Speicher-Board zusehen, wie sich `turn` von 1 über 2 auf 3 ändert.',
    },
    'connect-terminal-memory': {
      name: 'Vom Speicher ins Terminal',
      brief: 'Lies den Wert aus dem Speicher aus und gib ihn im Terminal aus. Füge die Zeile `print(hero)` hinzu.',
      learning: [
        'print(name) liest den Wert der Variablen aus dem Speicher und gibt ihn im Terminal aus',
        'Editor, Speicher-Board und Terminal bilden zusammen dein komplettes Studio',
      ],
      fieldNotes: [
        'Setze keine Anführungszeichen um hero in print(hero); sonst würde das Wort "hero" statt seines Werts ausgegeben',
        'Variablen an print() zu übergeben ist die universelle Methode zur Inspektion',
      ],
      lesson: 'Jetzt greifen alle Werkzeuge ineinander: Zeile 1 (`hero = "Ada"`) speichert den Text im RAM. Zeile 2 (`print(hero)`) schlägt den Namen im Speicher nach und schickt den Inhalt direkt an das Terminal!',
    },
    'change-a-value': {
      name: 'Einen Wert ändern',
      brief: 'Starte mit `age = 10` und ändere `age` dann so, dass sie 11 wird.',
      lesson: `Du kannst jederzeit ändern, worauf ein Name zeigt — schreib einfach noch einmal den Namen.

Die erste Zeile gibt \`age\` den Wert 10. Die zweite Zeile gibt ihm 11. Jetzt bedeutet \`age\` 11; der alte Wert 10 ist weg, es sei denn, etwas anderes zeigt noch darauf.

(Wir haben mit \`age = 10\` gestartet, damit du dich auf die Änderung konzentrieren kannst. Füge die zweite Zeile selbst hinzu.)`,
      learning: ['Denselben Namen erneut zu schreiben aktualisiert seinen Wert', 'Ein Name bedeutet immer seinen neuesten Wert'],
      fieldNotes: ['Zähler funktionieren so: `n = 0` und dann immer wieder `n = n + 1`', 'Der Wert wird ersetzt, nicht „an Ort und Stelle bearbeitet"'],
    },
    'do-math': {
      name: 'Ein bisschen rechnen',
      brief: 'Multipliziere 6 mit 7 und speichere das Ergebnis als `area`.',
      lesson: `Python kann rechnen. Die Symbole \`+\`, \`-\`, \`*\`, \`/\` sind die üblichen Addition, Subtraktion, Multiplikation und Division.

\`area = 6 * 7\` rechnet zuerst — 42 — und speichert das unter \`area\`. Du kannst Zahlen und Namen mischen: \`area = width * height\` funktioniert genauso.`,
      learning: ['Python wertet Ausdrücke aus, bevor es sie speichert', 'Die üblichen Rechenzeichen: + - * /'],
      fieldNotes: ['`//` ist ganzzahlige Division, `**` ist Potenz: `2 ** 3` ist 8', 'Eine häufige Aufgabe: einen Wert berechnen, speichern und wiederverwenden'],
    },
    'build-up': {
      name: 'Einen Wert aufbauen',
      brief: 'Starte mit `x = 4` und nutze dann `x` selbst, um daraus 7 zu machen.',
      lesson: `Hier ist der Trick, der fast die gesamte Programmierung entsperrt: Ein Wert kann auf *sich selbst* verweisen.

\`x = x + 3\` liest das aktuelle \`x\` (4), addiert 3 und speichert das Ergebnis (7) wieder unter \`x\`. Python liest zuerst die rechte Seite, mit dem Wert, den \`x\` *vor* dieser Zeile hatte.

Dieses Muster „jedes Mal ein kleines bisschen dazugeben" ist die Art, wie Zähler, Summen und Fortschritt aufgebaut werden.`,
      learning: ['`x = x + 3` liest den alten Wert, bevor es den neuen schreibt', 'Dieses Selbst-Update-Muster ist das Herz des Zählens'],
      fieldNotes: ['`x += 3` ist eine Kurzform, die exakt `x = x + 3` bedeutet', 'Das wirst du in jeder Schleife der nächsten Serie sehen'],
    },
    'your-name': {
      name: 'Ein Wort in einem Kasten',
      brief: 'Speichere das Wort `hi` (in Anführungszeichen, damit Python weiß, dass es Text ist) in `greeting`.',
      lesson: `Wörter müssen — anders als Zahlen — in Anführungszeichen geschrieben werden. Damit werden sie zu einem **String** — einem Stück Text, das Python wie einen Wert mitführen kann.

\`greeting = 'hi'\` speichert den Text \`hi\`. Du kannst ihn dann ausgeben, mit anderem Text verbinden oder an Funktionen übergeben. Schau auf das Canvas: Der String bekommt seinen eigenen Kasten, und \`greeting\` zeigt darauf.`,
      learning: ['Strings sind Text, eingewickelt in Anführungszeichen', 'Ein Name kann auf einen String zeigen, genauso wie auf eine Zahl'],
      fieldNotes: ['Anführungszeichen können einfach oder doppelt sein — beide erzeugen denselben String', 'Strings sind einer der am häufigsten genutzten Werte in Python'],
    },
    'combine-words': {
      name: 'Zwei Wörter verbinden',
      brief: 'Baue den String `hello world` aus zwei Stücken: `hello` und `world`.',
      lesson: `Genau wie \`+\` Zahlen addiert, kann es **Strings zusammenkleben**. Das nennt man Konkatenation.

\`'hello' + ' ' + 'world'\` verbindet drei Stücke — denk an das mittlere, das ein einzelnes Leerzeichen ist — zu \`hello world\`. So bauen Programme Nachrichten, Dateinamen und Text aus Teilstücken zusammen.`,
      learning: ['`+` verbindet Strings (Konkatenation)', 'Ein String ist einfach eine lange Abfolge von Zeichen'],
      fieldNotes: ["Ein vergessenes Leerzeichen ist der klassische Bug: `'hello' + 'world'` ergibt `helloworld`", 'Mit `+` kannst du auch einen Namen an ein Wort kleben'],
    },
    'how-long': {
      name: 'Wie lang ist es?',
      brief: 'Speichere die Anzahl der Buchstaben im Wort `python` als `n`. Nutze die `len`-Funktion.',
      lesson: `Python kommt mit nützlichen **Funktionen** aus der Schublade. \`len(...)\` zählt, wie viele Elemente etwas enthält.

\`len('python')\` zählt die Buchstaben und liefert 6, was wir als \`n\` speichern. Später wirst du \`len\` auch auf Listen verwenden — es beantwortet „wie viele?" für viele Dinge.`,
      learning: ['`len` zählt die Elemente eines Strings (oder einer Liste)', 'Eingebaute Funktionen erledigen häufige Dinge in einer Zeile'],
      fieldNotes: ['`len` funktioniert auf Strings, Listen und anderen Sammlungen', 'Elemente abzuzählen ist eines der häufigsten Bedürfnisse in Code'],
    },
    'true-or-false': {
      name: 'Wahr oder falsch',
      brief: 'Es gibt zwei Werte, die einfach „ja" und „nein" sind: `True` und `False`. Speichere den Wert `True` in `ready`.',
      lesson: `Bevor ein Programm eine Entscheidung treffen kann, braucht es Ja/Nein-Werte. Python nennt sie **Boolesche Werte** (Booleans), und es gibt genau zwei: \`True\` und \`False\` (mit großem Anfangsbuchstaben).

\`ready = True\` speichert den „Ja"-Wert. Diese Werte sind das, was Bedingungen liefern — Fragen, die nur mit ja oder nein beantwortet werden können.`,
      learning: ['Boolesche Werte sind die zwei Werte True und False', 'Sie sind die Antworten auf Ja/Nein-Fragen'],
      fieldNotes: ['Großes `T`/`F` ist Pflicht — `true`/`false` (klein) sind nicht dasselbe', 'Bedingungen (als Nächstes) liefern Boolesche Werte'],
    },
    'is-equal': {
      name: 'Gleichheit prüfen',
      brief: 'Vergleiche zwei Zahlen. Ist 3 gleich 3? Speichere die Antwort in `same`.',
      lesson: `Hier sind \`=\` und \`==\` *nicht* dasselbe:

- \`=\` **speichert** einen Wert (\`x = 5\`).
- \`==\` **fragt**: „Ist links gleich rechts?"

\`3 == 3\` stellt die Frage und antwortet \`True\`. Wir speichern diese Antwort in \`same\`. Vergleiche 5 mit 3, und du bekämst \`False\`.`,
      learning: ['`==` fragt „Sind diese gleich?" und liefert True/False', 'Ein `=` speichert; zwei `==` vergleichen'],
      fieldNotes: ['`!=` bedeutet „ungleich"', 'Weitere Vergleiche: `<`, `>`, `<=`, `>=`'],
    },
    'is-bigger': {
      name: 'Größer oder kleiner',
      brief: 'Frag, ob 10 größer als 7 ist. Speichere die Antwort in `bigger`. (Sie sollte True sein.)',
      lesson: `Neben \`==\` gibt es Vergleiche für die Größe:

- \`>\`  „größer als"
- \`<\`  „kleiner als"
- \`>=\` „mindestens" (größer oder gleich)
- \`<=\` „höchstens" (kleiner oder gleich)

Jeder stellt eine Ja/Nein-Frage und antwortet \`True\` oder \`False\`. \`10 > 7\` ist \`True\`.`,
      learning: ['Vergleiche liefern einen Booleschen Wert, keine Zahl', '>, <, >=, <= vergleichen die Größe'],
      fieldNotes: ['Vergleiche kette so, wie man sie aussprechen würde: `0 < x < 10` wird hier nicht unterstützt, aber `x > 0 and x < 10` funktioniert'],
    },
    'first-if': {
      name: 'Dein erstes if',
      brief: 'Mit bereits gespeichertem `score = 85` gib `good job` nur aus, wenn der Score 60 oder höher ist. (Hier ist er es also — gib es aus.)',
      lesson: `Jetzt kann das Programm *wählen*. Die \`if\`-Zeile endet mit einem Doppelpunkt, und die **eingezogenen** Zeilen darunter laufen nur, wenn der Test wahr ist.

\`if score >= 60:\` fragt „Ist der Score 60 oder mehr?" Hier ist der Score 85, also läuft der eingezogene \`print\`. Wäre der Score 40, würde derselbe Code nichts ausgeben.

Die Einrückung (die Leerzeichen am Zeilenanfang) sagt Python, welche Zeilen zum \`if\` gehören.`,
      learning: ['`if <Test>:` führt den eingezogenen Block nur aus, wenn der Test True ist', 'Die Einrückung definiert den Block'],
      fieldNotes: ['Der Test hinter `if` ist ein Boolescher Wert', 'Ändere den Score auf unter 60 und der print läuft still und leise nicht'],
    },
    'if-else': {
      name: 'If … else',
      brief: 'Mit gespeichertem `score = 40` gib `good job` aus, wenn der Score 60 oder höher ist, andernfalls gib `keep going` aus.',
      lesson: `Manchmal willst du *beide* Ergebnisse abdecken. Füge nach dem \`if\`-Block ein \`else:\` hinzu.

Die Regel ist sauber: Genau einer der beiden Blöcke läuft. Wenn der Test wahr ist, läuft der \`if\`-Block; wenn er falsch ist, läuft der \`else\`-Block. Nie beide, nie keiner.

Hier ist der Score 40, der Test schlägt also fehl und der \`else\`-Block gibt \`keep going\` aus.`,
      learning: ['`else:` läuft, wenn der `if`-Test False ist', 'Genau einer von `if`/`else` läuft'],
      fieldNotes: ['Diese if/else-Form ist das Rückgrat der meisten Programmlogik', 'Beide Zweige halten sich an ihre Einrückungsregeln'],
    },
    'elif-ladder': {
      name: 'Auswählen mit elif',
      brief: 'Bewerte einen `score` von 72: gib `A` aus, wenn er 90 oder höher ist, `B`, wenn er 70 oder höher ist, andernfalls `C`.',
      lesson: `Wenn es mehr als zwei Ergebnisse gibt, stellst du eine Reihe von \`elif\`-Stufen auf (kurz für „else if").

Python prüft jeden Test **von oben nach unten** und führt den ersten wahren aus, dann stoppt es. Hier ist 72 nicht 90+, aber es ist 70+, also läuft der \`elif\`-Block und gibt \`B\` aus. Das \`else\` ist der Auffang, falls nichts darüber zutrifft.

Die Reihenfolge zählt: Die Prüfungen laufen in der Reihenfolge, in der sie geschrieben sind.`,
      learning: ['`elif` fügt einem if/else weitere Zweige hinzu', 'Der erste wahre Zweig läuft; die übrigen werden übersprungen'],
      fieldNotes: ['Ein häufiger Bug: Zweige so anordnen, dass ein breiterer Test einen engeren versteckt', '`else` ist optional — weglassen, wenn „keine Übereinstimmung" bedeutet „nichts tun"'],
    },
    'and-or': {
      name: 'Und, oder, nicht',
      brief: 'Du kannst Fragen kombinieren. Speichere `in_range` als True nur, wenn `age` 18 oder mehr UND unter 65 ist.',
      lesson: `Drei Wörter erlauben dir, Boolesche Werte zu einer größeren Frage zu kombinieren:

- \`and\`  — beide müssen wahr sein
- \`or\`   — mindestens eines muss wahr sein
- \`not\`  — dreht wahr in falsch und umgekehrt

\`age >= 18 and age < 65\` ist wahr nur, wenn *beide* Hälften wahr sind. Bei Alter 40 sind beide wahr, also ist das Ganze \`True\`.`,
      learning: ['`and` braucht beide Seiten wahr', '`or` braucht mindestens eine Seite wahr', '`not` dreht einen Booleschen Wert um'],
      fieldNotes: ['Kombiniere so viele Bedingungen, wie du magst: `a and b and c`', 'Lies sie wie im Deutschen — genau darum geht es'],
    },
    'membership': {
      name: 'Ist es drin?',
      brief: 'Frag, ob der Buchstabe `a` im Wort `apple` vorkommt. Speichere die Antwort in `found`.',
      lesson: `Das Wort \`in\` stellt eine Enthaltenseins-Frage: Ist das Ding auf der linken Seite in dem Ding auf der rechten Seite?

\`'a' in 'apple'\` fragt, ob der Buchstabe \`a\` im Wort \`apple\` vorkommt — ja, also ist die Antwort \`True\`. Ändere den Buchstaben zu \`z\`, und es wird \`False\`.

Später nutzt du \`in\` auch auf Listen, in einer späteren Serie, auf dieselbe Weise.`,
      learning: ['`x in s` fragt, ob `x` in `s` vorkommt', '`in` liefert True/False'],
      fieldNotes: ['`not in` fragt das Gegenteil: `if z not in apple`', 'Enthaltensein ist der Weg, einen Wert gegen eine Sammlung zu prüfen'],
    },
    'count-with-range': {
      name: 'Mit einer Schleife zählen',
      brief: 'Nutze eine `for`-Schleife über `range(3)`, um jede Zahl zu `total` zu addieren, beginnend bei 0. (0 + 1 + 2.)',
      lesson: `Eine \`for\`-Schleife wiederholt ihren eingezogenen Block einmal pro Element. \`range(3)\` liefert die Zahlen 0, 1, 2.

Der Block läuft also dreimal, mit \`i\` als 0, dann 1, dann 2, und addiert es jedes Mal zu \`total\`. Am Ende ist \`total\` 0 + 1 + 2 = 3.

\`range\` ist der Partner der Schleife: \`range(3)\` zählt von 0 auf und stoppt vor 3.`,
      learning: ['`for x in range(n):` wiederholt `n`-mal, mit `x` = 0..n-1', 'Der eingezogene Block läuft einmal pro Element'],
      fieldNotes: ['`range` startet immer bei 0, wenn nicht anders angegeben', 'Das ist die häufigste Schleife in Python'],
    },
    'range-start-stop': {
      name: 'Eine range mit Start',
      brief: 'Addiere 3 + 4 + 5 + 6 + 7 mit einer Schleife. Speichere das Ergebnis in `sum5`.',
      lesson: `\`range\` kann zwei Zahlen annehmen: einen **Start** und einen **Stopp** (eins über das letzte).

\`range(3, 8)\` liefert 3, 4, 5, 6, 7 — startend bei 3, stoppend vor 8. Addiert: 3 + 4 + 5 + 6 + 7 = 25.

Merke: Der Stoppwert ist *nicht* enthalten. Diese Regel „hier anfangen, dort vor dem Punkt aufhören" ist das Einzige, was man über \`range\` wirklich verinnerlichen muss.`,
      learning: ['`range(start, stop)` zählt von `start` bis vor `stop`', 'Der Stoppwert wird nie erzeugt'],
      fieldNotes: ['Eine dritte Zahl ist der Schritt: `range(0, 10, 2)` ist 0, 2, 4, 6, 8', 'Den ausgeschlossenen Stoppwert zu übersehen ist der häufigste range-Fehler'],
    },
    'loop-a-string': {
      name: 'Über ein Wort schleifen',
      brief: 'Zähle mit einer Schleife, wie viele Buchstaben in `python` stecken. Speichere die Zählung in `count`.',
      lesson: `Eine \`for\`-Schleife funktioniert mit **jeder** Sammlung — nicht nur mit Ranges. Ein String ist einfach eine Sammlung von Buchstaben.

\`for ch in word:\` läuft einmal pro Buchstaben, mit \`ch\` als dem jeweils aktuellen Zeichen. Jedes Mal erhöhen wir \`count\` um 1. Nach dem letzten Buchstaben ist \`count\` 6.

Dieses „Schleifen-und-Zählen"-Muster funktioniert bei Listen exakt genauso.`,
      learning: ['`for` kann einen String Buchstabe für Buchstaben durchlaufen', 'Schleifen-und-zählen ist ein universelles Muster'],
      fieldNotes: ['Die Schleifenvariable (`ch`) bekommt jedes Mal einen neuen Wert', 'Dieselbe Schleife zählt auch Elemente in einer Liste'],
    },
    'while-loop': {
      name: 'Schleifen bis fertig',
      brief: 'Nutze eine `while`-Schleife, um `n` (startend bei 1) so lange zu verdoppeln, bis es mindestens 8 ist. Speichere den Endwert in `n`.',
      lesson: `Eine \`while\`-Schleife ist die andere Art von Schleife. Statt „wiederhole für jedes Element" sagt sie: „**Wiederhole, solange dies wahr ist.**"

Hier: Solange \`n\` unter 8 ist, verdopple es. 1 → 2 → 4 → 8. Jetzt ist 8 nicht unter 8, also stoppt die Schleife, und \`n\` ist 8.

Nutze \`for\`, wenn du weißt, wie oft; nutze \`while\`, wenn du wiederholst, bis sich eine Bedingung ändert.`,
      learning: ['`while <Test>:` wiederholt, solange der Test True bleibt', 'Nutze `while`, wenn die Anzahl der Wiederholungen nicht von vornherein bekannt ist'],
      fieldNotes: ['Sorge immer dafür, dass der Test irgendwann False wird — eine `while True` ohne Ausweg läuft ewig', '`while` ist ideal für „warte, bis …"-Logik'],
    },
    'loop-with-if': {
      name: 'Schleife plus Entscheidung',
      brief: 'Gib jede gerade Zahl von 0 bis 5 aus. (Nutze eine `for`-Schleife und darin ein `if`.)',
      lesson: `Schleifen und \`if\` kombinieren sich ständig. Hier geht die Schleife 0, 1, 2, 3, 4, 5 durch, und das \`if\` darin gibt eine Zahl nur aus, wenn sie gerade ist.

Das Zeichen \`%\` ist der **Rest**: \`i % 2\` ist das, was übrig bleibt bei der Division durch 2. Eine Zahl ist genau dann gerade, wenn \`i % 2 == 0\`.

Die Schleife *macht* also jede Zahl, gibt aber nur die geraden aus: 0, 2, 4.`,
      learning: ['Du kannst ein `if` in eine `for`-Schleife nesten', '`%` gibt den Rest; `x % 2 == 0` testet auf gerade'],
      fieldNotes: ['Während des Schleifens zu filtern ist überall: Überspringe das, was du nicht willst', '`%` (Modulo) ist das Arbeitspferd für „jedes n-te Element"'],
    },
    'break-out': {
      name: 'Vorzeitig stoppen mit break',
      brief: 'Durchsuche die Zahlen 1 bis 9 nach der ersten, die durch 7 teilbar ist. Gib sie aus, dann `break` aus der Schleife aus. (Es ist 7.)',
      lesson: `Manchmal willst du eine Schleife *vorzeitig* stoppen, bevor sie alle Elemente abgearbeitet hat. Das macht \`break\`: Es springt direkt aus der Schleife heraus.

Diese Schleife durchläuft 1, 2, 3, … . Bei jeder Zahl fragt sie „Ist diese durch 7 teilbar?" Die meisten nicht, also passiert nichts. Bei 7 ist der Test wahr, es gibt 7 aus, und \`break\` beendet die Schleife an genau dieser Stelle — 8 und 9 werden nie besucht.

\`range(1, 10)\` startet bei 1, damit wir nicht an 0 stehen bleiben (die ist auch durch 7 teilbar).`,
      learning: ['`break` verlässt die innerste Schleife sofort', 'Nutze es, sobald du gefunden hast, wonach du suchst'],
      fieldNotes: ['`break` stoppt die gesamte Schleife, nicht nur eine Iteration', 'Gekoppelt mit einer Suche: Finde den Treffer, dann break'],
    },
    'watch-the-loop': {
      name: 'Zuschauen, wie die Schleife läuft',
      brief: 'Baue die Liste `[1, 4, 9]` — die Quadrate von 1, 2, 3 — mit einer `for`-Schleife. Dann drücke auf die Schritt-Regler und beobachte jede Iteration auf dem Canvas.',
      lesson: `Jetzt hast du jedes Schleifen-Werkzeug kennengelernt. Diese Stufe ist die Gelegenheit, eine Schleife *Schritt für Schritt* beim Ausführen zuzuschauen.

Die Schleife quadriert jede Zahl 1, 2, 3 und lässt die Liste \`sq\` wachsen: sie wird zu \`[1]\`, dann \`[1, 4]\`, dann \`[1, 4, 9]\`.

Wenn du abschickst, nutze die Schritt-Regler unter dem Canvas, um die Ausführung durchzugehen. Jeder Druck geht eine Anweisung weiter, und du kannst beobachten, wie \`sq\` wächst und die Schleifenvariable sich auf dem Canvas verändert. Dieses Bild — „eine Schleife ist einfach dieselbe Zeile, immer und immer wieder ausgeführt" — ist die gesamte Idee einer Schleife.`,
      learning: ['Eine Schleife ist ein wiederholter Code-Block, nicht jedes Mal neuer Code', 'Jede Schleife lässt sich auf dem Canvas Schritt für Schritt beim Ausführen zusehen'],
      fieldNotes: ['Eine Liste in einer Schleife aufbauen — so transformiert man Daten', 'Nutze die Schritt-Regler, um jede Stufenausführung zu inspizieren'],
    },
    'define-function': {
      name: 'Eine Funktion definieren',
      brief: 'Definiere `double(n)`, die `n * 2` zurückgibt. Rufe sie nicht auf — definiere sie nur, damit ein Funktionsobjekt auf dem Heap sitzt.',
      lesson: `\`def\` erstellt ein **Funktionsobjekt** auf dem Heap und bindet seinen Namen im aktuellen Frame. Bis du es aufrufst, läuft der Körper nie.

Der Name \`double\` ist einfach ein weiterer Name — einer, der zufällig auf ein aufrufbares Objekt zeigt. Definieren und Aufrufen sind zwei getrennte Schritte.`,
      learning: ['`def` baut ein Funktionsobjekt und bindet seinen Namen', 'Eine Funktion läuft nicht, bis sie aufgerufen wird'],
      fieldNotes: ['Funktionen sind erstklassige Werte: Du kannst sie weitergeben', 'Der Körper läuft bei jedem Aufruf frisch'],
    },
    'call-and-bind': {
      name: 'Aufrufen und binden',
      brief: 'Definiere `double(n)`, die `n * 2` zurückgibt, dann binde `r = double(21)` so, dass `r` 42 ist. Beobachte, wie der Aufruf-Frame auftaucht und verschwindet.',
      lesson: `Wenn \`double(21)\` aufgerufen wird, schiebt es einen **neuen Frame** auf den Stack mit seinem eigenen lokalen \`n = 21\`, führt den Körper aus und gibt \`42\` zurück in den Modul-Frame, wo \`r\` es auffängt.

Wenn der Aufruf zurückkehrt, wird der temporäre Frame wieder abgestoßen — nur sein Rückgabewert überlebt, jetzt an \`r\` gebunden. Dieses Push/Pop von Frames ist, wie Python lokale Variablen isoliert hält.`,
      learning: ['Ein Aufruf erzeugt einen temporären Frame, der beim Return abgestoßen wird', 'Lokale Variablen existieren nur, während der Aufruf läuft'],
      fieldNotes: ['Tiefe Aufruf-Stacks sind das, wie Rekursion funktioniert', 'Jeder Frame hat seinen eigenen `locals()`-Namespace'],
    },
    'print-is-not-magic': {
      name: 'Print ist keine Magie',
      brief: 'Gib die Zeile `hello 3` mit `print` aus. Ausgeben schreibt auf stdout — es bindet keinen Namen.',
      lesson: `\`print\` ist eine Funktion, kein Schlüsselwort. Sie nimmt Werte an, schreibt sie auf **stdout** und gibt \`None\` zurück. Sie bindet keinen Namen, also erscheint nichts Neues in deinem Frame.

Im Visualizer erscheint das Ausgeben im Terminal und in \`state.stdout\` — nicht als neues Objekt auf dem Canvas.`,
      learning: ['`print` schreibt auf stdout und bindet nichts', 'Ein Funktionsaufruf kann Ausgabe erzeugen, ohne einen Wert zu erzeugen'],
      fieldNotes: ['`print` ist der Weg, wie du beim Debuggen Zustand beobachtest', 'Das Umleiten von stdout ist, wie Logging und das Fangen von Ausgabe funktionieren'],
    },
    'rebind-in-fn-is-local': {
      name: 'Neu binden innerhalb einer Funktion',
      brief: 'Hier wird es subtil: Nach `x = 1` sollte eine Funktion, die `x = 2` macht, das modulweite `x` NICHT ändern — es bleibt 1.',
      lesson: `Innerhalb von \`bump\` bindet die Anweisung \`x = 2\` ein *lokales* \`x\` im eigenen Frame der Funktion neu. Es berührt das modulweite \`x\` nicht, das bleibt \`1\`.

Da Python eine Zuweisung an \`x\` sieht (und keine bloße Referenz), wird das innere \`x\` als frisches lokales behandelt. Das ist die häufigste Überraschung „meine Funktion hat meinen globalen nicht geändert" — und der Grund, warum \`global\`/\`nonlocal\` existieren.`,
      learning: ['Eine Zuweisung an einen Namen innerhalb einer Funktion erzeugt ein lokales', 'Ein lokales neu zu binden berührt den äußeren Bereich nicht'],
      fieldNotes: ['Nutze `global x` (oder `nonlocal`), um einen äußeren Namen absichtlich neu zu binden', 'Das Verändern eines gemeinsamen veränderlichen Objekts *entkommt* der Funktion — ein Neubinden nicht'],
    },
  },
};
