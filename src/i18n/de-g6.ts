/**
 * German translations for Phase 10 extended series:
 * slicing, recursion, closures, regex, typing-pydantic, docstrings,
 * testing-pytest, sqlalchemy, production.
 */

import type { LevelGroup } from './types';

export const deG6: LevelGroup = {
  seriesTitles: {
    slicing: 'Slicing & Schritte',
    recursion: 'Rekursion & Aufruf-Stack',
    closures: 'Closures & Lazy-Auswertung',
    regex: 'Reguläre Ausdrücke (re)',
    'typing-pydantic': 'Typisierung & Pydantic',
    docstrings: 'Docstrings & Standards',
    'testing-pytest': 'Testen mit Pytest & Mocks',
    sqlalchemy: 'SQLAlchemy & Identity Map',
    production: 'Produktion & Architektur',
  },
  deepLessons: {
    slicing: `## Beginner: Die Grundlagen des Slicings
Mit Slicing greifst du über \`[start:stop]\` auf Teilfolgen von Listen, Tupeln und Strings zu:
\`\`\`python
xs = [10, 20, 30, 40, 50]
sub = xs[1:4]  # [20, 30, 40]
\`\`\`
Jedes Slicing einer Standard-Liste allokiert ein völlig neues Objekt auf dem Heap.

## Intermediate: Schritte und negative Indizes
Mit \`[start:stop:step]\` lässt sich die Schrittweite steuern. Ein negativer Schritt kehrt die Folge um:
\`\`\`python
xs = [1, 2, 3, 4, 5]
evens = xs[::2]   # [1, 3, 5]
rev = xs[::-1]    # [5, 4, 3, 2, 1]
\`\`\`

## Advanced: Zuweisung an Slices
Im Gegensatz zum Lesen verändert die Zuweisung an ein Slice die Liste direkt an Ort und Stelle:
\`\`\`python
xs = [1, 2, 3, 4]
xs[1:3] = [200, 300]  # [1, 200, 300, 4]
\`\`\`

## Expert: Slice-Objekte vs. NumPy-Views
Unter der Haube erzeugt \`xs[1:4]\` ein \`slice(1, 4)\`-Objekt.
In Standard-Python erzeugt das Slicing von Listen eine flache Kopie; in NumPy erzeugt es eine speichereffiziente Sicht (View) auf denselben Datenpuffer.`,

    recursion: `## Beginner: Aufbau einer rekursiven Funktion
Eine Funktion, die sich selbst aufruft, ist rekursiv. Sie benötigt stets:
1. Einen Basisfall zum Stoppen
2. Einen Rekursionsschritt

\`\`\`python
def countdown(n):
    if n <= 0:
        return "blastoff"
    return countdown(n - 1)
\`\`\`

## Intermediate: Lebenszyklus des Aufruf-Stacks
Jeder Funktionsaufruf legt einen neuen Frame auf dem Stack ab. Erst wenn der oberste Frame zurückkehrt, wird der Stack schrittweise abgebaut.

## Advanced: Stack-Frames vs. Heap-Objekte
Stack-Frames sind flüchtig und verschwinden nach dem Return. Heap-Objekte überleben, solange Referenzen auf sie existieren.

## Expert: Rekursionslimits und Tail-Call-Verhalten
Python implementiert bewusst keine Tail-Call-Optimierung (TCO). Überschreitet die Rekursionstiefe das Limit (Standard 1000), löst Python eine \`RecursionError\` aus.`,

    closures: `## Beginner: Verschachtelte Funktionen
Funktionen sind in Python erstklassige Objekte. Innere Funktionen greifen auf Namen der umschließenden Funktion zu.

## Intermediate: Was ist eine Closure?
Eine Closure bindet Variablen aus umschließenden Gültigkeitsbereichen, selbst wenn die äußere Funktion längst beendet ist.

## Advanced: Generatoren und yield
Mit \`yield\` pausieren Generatoren ihre Ausführung und halten ihren Zustand fest:
\`\`\`python
def count():
    yield 1
    yield 2
\`\`\`

## Expert: Speichereffizienz von Lazy Pipelines
Während Listen-Comprehensions alle Elemente sofort im Speicher ablegen (O(N)), erzeugen Generator-Pipelines Werte nach Bedarf mit O(1) Speicherbedarf.`,

    regex: `## Beginner: Einführung in Reguläre Ausdrücke
Mit dem \`re\`-Modul analysierst du Textmuster:
\`\`\`python
import re
p = re.compile(r"\\d+")
m = p.search("Item 42")
\`\`\`

## Intermediate: Erfassungsgruppen
Klammern bilden Gruppen, die gezielt ausgelesen werden können: \`m.group(1)\`.

## Advanced: Ersetzungen mit Callbacks
\`re.sub()\` ersetzt Vorkommnisse wahlweise mit Strings oder Transformationsfunktionen.

## Expert: Engine-Performance und ReDoS
Die CPython-Regex-Engine nutzt Backtracking. Bei verschachtelten Quantifikatoren muss auf exponentielle Laufzeiten geachtet werden.`,

    'typing-pydantic': `## Beginner: Warum Typ-Hinweise?
Typ-Hinweise (PEP 484) dokumentieren Funktionssignaturen, werden zur Laufzeit von Standard-Python jedoch nicht erzwungen.

## Intermediate: Generische Typen
Seit Python 3.9 unterstützen eingebaute Typen wie \`list[int]\` und \`dict[str, float]\` generische Parameter direkt.

## Advanced: Pydantic v2
Pydantic validiert Datenmodelle zur Laufzeit und wandelt Typen automatisch passend um.

## Expert: Architektur in Microservices
Pydantic-Modelle bilden die Grundlage moderner APIs (FastAPI) für Request-Validierung und Schemagenerierung.`,

    docstrings: `## Beginner: Zweck von Docstrings
Docstrings beschreiben die Schnittstelle von Funktionen, Klassen und Modulen mittels dreifacher Anführungszeichen.

## Intermediate: Docstrings zur Laufzeit
Docstrings werden an das Attribut \`__doc__\` gebunden und von \`help()\` formatiert.

## Advanced: Dokumentationsstile (Google & NumPy)
Google- und NumPy-Stile strukturieren Parameter und Rückgabewerte einheitlich für Dokumentationswerkzeuge.

## Expert: Ausführbare Doctests
Mit \`doctest\` werden interaktive Beispiele in Docstrings automatisch als Tests ausgeführt.`,

    'testing-pytest': `## Beginner: Die Pytest-Philosophie
Pytest setzt auf Standard-\`assert\`-Anweisungen und bietet detailreiche Fehlerberichte.

## Intermediate: Test-Fixtures
Fixtures verwalten Testdaten und Ressourcen sauber vor und nach Testläufen.

## Advanced: Mocks mit MagicMock
\`unittest.mock.MagicMock\` simuliert externe Schnittstellen und zeichnet Aufrufe auf.

## Expert: Moderne Test-Pipelines
Parametrisierte Tests (\`@pytest.mark.parametrize\`) testen Randfälle effizient ab.`,

    sqlalchemy: `## Beginner: Das ORM-Konzept
SQLAlchemy bildet relationale Tabellen auf Python-Klassen und Zeilen auf Objekte ab.

## Intermediate: Engine und Session
Die Engine verwaltet Datenbankverbindungen; die Session steuert Transaktionen und Einheiten der Arbeit.

## Advanced: Beziehungen und Fremdschlüssel
Fremdschlüssel und \`relationship()\` ermöglichen die Navigation zwischen verknüpften Modellen.

## Expert: Das Identity-Map-Muster
Die Identity Map stellt sicher, dass wiederholte Abfragen desselben Primärschlüssels dieselbe Objektinstanz im Speicher zurückgeben: \`u1 is u2\` ist wahr!`,

    production: `## Beginner: Das 12-Factor-Prinzip
Konfigurationen gehören in Umgebungsvariablen (\`os.environ\`), getrennt vom Quellcode.

## Intermediate: FastAPI Web-Architektur
FastAPI kombiniert asynchrone Endpunkte mit automatischer Pydantic-Validierung.

## Advanced: Dependency Injection
Mit \`Depends()\` werden Abhängigkeiten wie Datenbankverbindungen modular in Endpunkte injiziert.

## Expert: Produktionsreife Services
Strukturierte JSON-Logs, Health-Checks und saubere Graceful-Shutdown-Routinen sichern den Betrieb.`,
  },
  levels: {
    'slice-start-stop': {
      name: 'Einfacher Slice erzeugt eine Kopie',
      brief: 'Extrahiere `sub = xs[1:4]` aus `xs`. Beobachte auf dem Speicherboard, dass `sub` eine völlig neue Liste auf dem Heap ist.',
      lesson: 'Das Slicing einer Liste mit `[start:stop]` kopiert die Elemente in ein neues Listenobjekt auf dem Heap.',
    },
    'slice-step': {
      name: 'Schrittweises Slicing',
      brief: 'Extrahiere jedes zweite Element mit `evens = xs[::2]`.',
      lesson: 'Der dritte Parameter bestimmt die Schrittweite. Ohne start und stop wird die gesamte Liste durchlaufen.',
    },
    'slice-negative-reverse': {
      name: 'Negative Schritte und Umkehren',
      brief: 'Kehre die Liste mit `rev = xs[::-1]` in eine neue Liste um.',
      lesson: 'Ein negativer Schritt durchläuft die Sequenz rückwärts und erzeugt eine neue umgekehrte Liste.',
    },
    'slice-assignment': {
      name: 'Zuweisung an Slices',
      brief: 'Ersetze die mittleren Elemente mit `xs[1:3] = [200, 300]`. Die Liste wird direkt verändert.',
      lesson: 'Slice-Zuweisungen modifizieren die bestehende Liste an Ort und Stelle, ohne ihre Identität zu ändern.',
    },
    'slice-object-vs-view': {
      name: 'Slice-Objekte vs. NumPy-Views',
      brief: 'Erstelle `s = slice(1, 4)` und wende es auf `xs` an: `res = xs[s]`.',
      lesson: 'In Standard-Python erzeugt ein Slice eine Kopie; in NumPy erzeugen Slices speicherteilende Views.',
    },
    'recursion-base-case': {
      name: 'Der Basisfall',
      brief: 'Rufe `countdown(1)` auf und speichere das Ergebnis in `res`. Der Basisfall beendet die Rekursion.',
      lesson: 'Jede rekursive Funktion benötigt einen Basisfall, um unendliche Aufrufe zu verhindern.',
    },
    'recursion-countdown': {
      name: 'Aufbau von Stack-Frames',
      brief: 'Definiere `sum_to(n)` und berechne `total = sum_to(3)`. Beobachte die Aufruf-Frames.',
      lesson: 'Jeder rekursive Aufruf legt einen neuen Frame auf dem Stack ab, bis der Basisfall erreicht ist.',
    },
    'recursion-call-stack': {
      name: 'Fakultät und Frame-Rückkehr',
      brief: 'Berechne `f = fact(4)` rekursiv.',
      lesson: 'Beim Rücklauf werden die berechneten Werte von oben nach unten an die Aufrufer zurückgegeben.',
    },
    'recursion-accumulator': {
      name: 'Akkumulator-Muster',
      brief: 'Rufe `acc_sum(3, 0)` auf und speichere in `result`.',
      lesson: 'Akkumulatoren übergeben Zwischenergebnisse als Parameter nach vorne.',
    },
    'recursion-depth-limit': {
      name: 'Rekursionslimits',
      brief: 'Führe `safe_recurse(5)` aus und binde an `val`.',
      lesson: 'Python schützt den Aufruf-Stack durch ein Rekursionslimit vor Speicherüberläufen.',
    },
    'closure-inner-function': {
      name: 'Verschachtelte Funktionen',
      brief: 'Rufe `make_greeter("Hi")` auf und binde die Funktion an `greet`.',
      lesson: 'Innere Funktionen haben über lexikalische Gültigkeit Zugriff auf Variablen der äußeren Funktion.',
    },
    'closure-state-capture': {
      name: 'Zustandserfassung überlebt Frames',
      brief: 'Rufe `c()` zweimal auf und binde das zweite Ergebnis an `count`.',
      lesson: 'Closures halten Variablen auf dem Heap am Leben, selbst wenn der äußere Frame abgebaut wurde.',
    },
    'generator-function': {
      name: 'Generatorfunktionen und yield',
      brief: 'Erstelle `g = gen_nums()` und lies den ersten Wert mit `first = next(g)`.',
      lesson: 'Funktionen mit yield geben Generatoren zurück, die bei next() schrittweise ausgeführt werden.',
    },
    'generator-expression': {
      name: 'Generator-Expressions',
      brief: 'Erstelle `squares_gen = (x * x for x in [1, 2, 3])` und lies `val = next(squares_gen)`.',
      lesson: 'Generator-Ausdrücke berechnen Werte erst bei Abruf (lazy evaluation).',
    },
    'lazy-vs-eager-memory': {
      name: 'Speicherprofile: Eager vs. Lazy',
      brief: 'Vergleiche `eager` Liste mit `lazy` Generator und lies `first = next(lazy)`.',
      lesson: 'Listen belegen O(N) Speicher, während Generatoren Werte mit O(1) Speicherbedarf streamen.',
    },
    're-match-literal': {
      name: 'Kompilieren und Suchen',
      brief: 'Kompiliere ein Ziffernmuster und suche im Text mit `re.compile` und `search`.',
      lesson: 're.compile() erzeugt wiederverwendbare Pattern-Objekte auf dem Heap.',
    },
    're-search-digits': {
      name: 'Alle Treffer finden',
      brief: 'Extrahiere alle Zahlen mit `re.findall(r"\\d+", ...)`.',
      lesson: 're.findall() gibt alle übereinstimmenden Teilstrings als Liste zurück.',
    },
    're-capture-groups': {
      name: 'Erfassungsgruppen',
      brief: 'Extrahiere den Benutzernamen aus einer E-Mail mit `m.group(1)`.',
      lesson: 'Klammern definieren nummerierte Gruppen, die gezielt aus dem Match-Objekt gelesen werden.',
    },
    're-sub-replace': {
      name: 'Regex-Ersetzung',
      brief: 'Ersetze Leerzeichen mit `re.sub(r"\\s+", "-", ...)`.',
      lesson: 're.sub() erzeugt einen neuen String mit ersetzten Mustern.',
    },
    're-flags-multiline': {
      name: 'Regex-Flags und Zeilenanker',
      brief: 'Finde Zeilenanfänge mit `re.MULTILINE`.',
      lesson: 'Flags verändern das Musterverhalten über Zeilen- und Zeichengrenzen hinweg.',
    },
    'typing-type-hints': {
      name: 'Typ-Annotationen',
      brief: 'Definiere eine typisierte Funktion `greet(name: str) -> str` und rufe sie auf.',
      lesson: 'Typ-Annotationen dokumentieren Signaturen für IDEs und statische Typprüfer.',
    },
    'typing-generic-types': {
      name: 'Generische Containertypen',
      brief: 'Verwende `list[int]` zur Typisierung von `first_num`.',
      lesson: 'Python 3.9+ unterstützt generische Container direkt ohne zusätzliche Importe.',
    },
    'pydantic-basic-model': {
      name: 'Pydantic BaseModel',
      brief: 'Definiere ein User-Modell und erstelle `user = User(id=1, name="Alice")`.',
      lesson: 'Pydantic-Modelle erzwingen und validieren Typen zur Laufzeit.',
    },
    'pydantic-validation-error': {
      name: 'Typ-Koerzierung',
      brief: 'Erstelle `User(id="42", name="Bob")` und beobachte die automatische Umwandlung.',
      lesson: 'Pydantic wandelt kompatible Datentypen automatisch um und meldet ungültige Eingaben.',
    },
    'pydantic-nested-model': {
      name: 'Verschachtelte Modelle',
      brief: 'Erstelle verschachtelte Modelle und exportiere ein Dictionary mit `model_dump()`.',
      lesson: 'model_dump() serialisiert verschachtelte Pydantic-Strukturen in Standard-Dictionaries.',
    },
    'docstring-pep257': {
      name: 'PEP 257 Docstrings',
      brief: 'Füge einer Funktion einen dreifach-gequoteten Docstring hinzu.',
      lesson: 'Docstrings dokumentieren Funktionen und Klassen nach dem Standard PEP 257.',
    },
    'docstring-access': {
      name: 'Docstrings zur Laufzeit',
      brief: 'Lies den Docstring mit `doc = calculate.__doc__` aus.',
      lesson: 'Python speichert Docstrings im Attribut __doc__ direkt auf dem Heap.',
    },
    'docstring-google-style': {
      name: 'Google-Stil Docstrings',
      brief: 'Definiere eine Funktion mit Google-Docstring (Args und Returns).',
      lesson: 'Der Google-Stil strukturiert Dokumentation übersichtlich mit standardisierten Abschnitten.',
    },
    'docstring-numpy-style': {
      name: 'NumPy-Stil Docstrings',
      brief: 'Definiere eine Funktion mit unterstrichenen Parametern im NumPy-Stil.',
      lesson: 'Der NumPy-Stil ist der Standard für wissenschaftliche Bibliotheken in Python.',
    },
    'docstring-doctest': {
      name: 'Ausführbare Doctests',
      brief: 'Führe Doctests mit `doctest.testmod().failed` aus.',
      lesson: 'Doctests stellen sicher, dass Codebeispiele in der Dokumentation stets korrekt bleiben.',
    },
    'pytest-assert': {
      name: 'Assert-Anweisungen',
      brief: 'Prüfe ein Testergebnis mit `assert add(2, 3) == 5`.',
      lesson: 'Pytest nutzt einfache assert-Befehle und liefert aussagekräftige Fehlerausgaben.',
    },
    'pytest-mock': {
      name: 'Mocking mit MagicMock',
      brief: 'Erstelle ein `MagicMock(return_value=42)` und prüfe Aufrufe.',
      lesson: 'MagicMock simuliert Abhängigkeiten und zeichnet alle Funktionsaufrufe auf.',
    },
    'pytest-fixture': {
      name: 'Fixture-Muster',
      brief: 'Simuliere eine Test-Fixture für Datenbankeinträge.',
      lesson: 'Fixtures trennen die Testvorbereitung sauber von den eigentlichen Testprüfungen.',
    },
    'pytest-parametrize': {
      name: 'Parametrisierte Tests',
      brief: 'Teste mehrere Eingaben in einer Schleife ab.',
      lesson: 'Parametrisierung prüft mehrere Testfälle isoliert mit einer einzigen Testfunktion.',
    },
    'pytest-exception-test': {
      name: 'Ausnahmetests',
      brief: 'Prüfe erwartete Fehler mit `pytest.raises(ZeroDivisionError)`.',
      lesson: 'pytest.raises stellt sicher, dass Fehlerfälle erwartungsgemäß ausgelöst werden.',
    },
    'sqlalchemy-declarative-model': {
      name: 'Deklaratives ORM-Modell',
      brief: 'Definiere ein Item-Modell mit `declarative_base()`.',
      lesson: 'SQLAlchemy bildet Tabellenspalten deklarativ auf Klassenattribute ab.',
    },
    'sqlalchemy-memory-session': {
      name: 'In-Memory Engine & Session',
      brief: 'Erstelle eine SQLite-In-Memory-Engine und öffne eine Session.',
      lesson: 'Die Session verwaltet Transaktionen und Einheiten der Arbeit im Arbeitsspeicher.',
    },
    'sqlalchemy-add-query': {
      name: 'Datensätze hinzufügen & abfragen',
      brief: 'Füge ein Item hinzu, committe und frage es mit `first()` ab.',
      lesson: 'sess.add() und sess.commit() schreiben Daten in die relationale Datenbank.',
    },
    'sqlalchemy-foreign-key': {
      name: 'Fremdschlüssel & Beziehungen',
      brief: 'Definiere ForeignKey und relationship zwischen Author und Post.',
      lesson: 'relationship() ermöglicht die direkte Objektnavigation zwischen verknüpften Datensätzen.',
    },
    'sqlalchemy-identity-map': {
      name: 'Das Identity-Map-Muster',
      brief: 'Frage denselben Datensatz zweimal ab und beweise `u1 is u2`.',
      lesson: 'Die Identity Map garantiert, dass Zeilen nur einmal auf dem Heap existieren: u1 is u2 ist True!',
    },
    'prod-env-vars': {
      name: '12-Factor Umgebungsvariablen',
      brief: 'Lies eine Konfiguration mit `os.environ.get()` aus.',
      lesson: 'Umgebungsvariablen trennen Umgebungskonfigurationen strikt vom Quellcode.',
    },
    'prod-logging': {
      name: 'Strukturiertes Logging',
      brief: 'Konfiguriere das Logging mit `logging.getLogger()`.',
      lesson: 'Logging liefert filterbare Diagnosenachrichten für Produktionsumgebungen.',
    },
    'prod-fastapi-app': {
      name: 'FastAPI Web-Anwendung',
      brief: 'Erstelle eine FastAPI-Instanz und definiere eine Health-Route.',
      lesson: 'FastAPI verknüpft HTTP-Routen mit asynchronen Python-Funktionen.',
    },
    'prod-fastapi-client': {
      name: 'Integrationstest mit TestClient',
      brief: 'Teste einen Endpunkt im Speicher mit `TestClient(app)`.',
      lesson: 'TestClient testet HTTP-Routen ohne Netzwerk-Overhead direkt im Speicher.',
    },
    'prod-dependency-injection': {
      name: 'Dependency Injection mit Depends',
      brief: 'Injiziere Abhängigkeiten in Routen mit `Depends()`.',
      lesson: 'Depends() entkoppelt Endpunkte von Ressourcen und erleichtert automatisierte Tests.',
    },
  },
};
