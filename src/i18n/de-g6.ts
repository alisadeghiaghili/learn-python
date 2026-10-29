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
    oop: 'Objektorientierte Programmierung (OOP)',
    'oop-advanced': 'Fortgeschrittene OOP & Datenmodell',
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

    oop: `## Beginner: Klassen als Baupläne und Objekte auf dem Heap
Eine Klasse definiert Datenstruktur und Verhalten. Beim Aufruf der Klasse wird eine Instanz auf dem Heap erzeugt:
\`\`\`python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

p1 = Point(1, 2)
p2 = Point(1, 2)
print(p1 is p2)  # False: zwei getrennte Heap-Objekte!
\`\`\`
Jede Instanz besitzt eine eindeutige Adresse, Referenzzähler und ein Attribut-Dictionary.

## Intermediate: Der Lebenszyklus einer Instanz und __init__
Bei der Instanziierung:
1. \`__new__()\` reserviert den Speicher für das Instanz-Objekt auf dem Heap.
2. \`__init__()\` initialisiert die Felder der Instanz über \`self\`.
3. Die Referenz auf das Objekt wird an den Aufrufer zurückgegeben.

\`self\` ist kein Schlüsselwort, sondern der explizite Name der aktuellen Instanz.

## Advanced: Methodenbindung, Kapselung und Vererbung mit super()
Methoden binden Verhalten an Zustand:
\`\`\`python
class Animal:
    def sound(self):
        return "generic"

class Dog(Animal):
    def sound(self):
        return "woof"
\`\`\`
Wird \`d = Dog()\` aufgerufen, bindet Python die Methode an die Instanz \`d\`.

Subklassen erben Methoden und können diese überschreiben oder mit \`super()\` erweitern.

## Expert: Attributauflösung, Namensraum-Shadowing und MRO
Die Attributsuche folgt einer festen Reihenfolge:
1. Prüfe das Instanz-Dictionary (\`inst.__dict__\`).
2. Prüfe das Klassen-Dictionary (\`type(inst).__dict__\`).
3. Durchlaufe die Method Resolution Order (MRO) der Basisklassen.

Eine Zuweisung \`inst.attr = val\` schreibt in Schritt 1 und überdeckt (shadowt) das Klassenattribut.`,

    production: `## Beginner: Das 12-Factor-Prinzip
Konfigurationen gehören in Umgebungsvariablen (\`os.environ\`), getrennt vom Quellcode.

## Intermediate: FastAPI Web-Architektur
FastAPI kombiniert asynchrone Endpunkte mit automatischer Pydantic-Validierung.

## Advanced: Dependency Injection
Mit \`Depends()\` werden Abhängigkeiten wie Datenbankverbindungen modular in Endpunkte injiziert.

## Expert: Produktionsreife Services
Strukturierte JSON-Logs, Health-Checks und saubere Graceful-Shutdown-Routinen sichern den Betrieb.`,
    'oop-advanced': `## Beginner: Zeichenketten-Darstellung (__repr__ vs. __str__)
Jedes Python-Objekt kann zwei unterschiedliche String-Darstellungen bereitstellen:
\`\`\`python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y
    def __str__(self):
        return f"({self.x}, {self.y})"
    def __repr__(self):
        return f"Point({self.x}, {self.y})"
\`\`\`
- \`__str__\` richtet sich an Endbenutzer (aufgerufen durch \`print()\`, \`str()\` und f-Strings).
- \`__repr__\` richtet sich an Entwickler und Debugging-Tools (aufgerufen durch \`repr()\`, REPL und Logs).
Fehlt \`__str__\`, greift Python automatisch auf \`__repr__\` zurück.

## Intermediate: Kapselung, Deskriptoren und Validierung mit @property
In Python werden direkte Attributzugriffe bevorzugt. Müssen später Validierungen oder Berechnungen ergänzt werden, bietet \`@property\` saubere Kapselung ohne Bruch der öffentlichen Schnittstelle:
\`\`\`python
class BankAccount:
    def __init__(self, balance):
        self._balance = balance

    @property
    def balance(self):
        return self._balance

    @balance.setter
    def balance(self, amount):
        if amount < 0:
            raise ValueError("Kontostand darf nicht negativ sein")
        self._balance = amount
\`\`\`
Unter der Haube ist \`@property\` ein Python-Deskriptor mit \`__get__\` und \`__set__\`.

## Advanced: Alternative Konstruktoren und Operatorüberladung
Python erlaubt Klassen, Sprachoperatoren und Instanziierungsmuster anzupassen:
\`\`\`python
class Money:
    def __init__(self, amount, currency="EUR"):
        self.amount = amount
        self.currency = currency

    @classmethod
    def from_cents(cls, cents, currency="EUR"):
        return cls(cents / 100, currency)

    def __add__(self, other):
        if not isinstance(other, Money) or self.currency != other.currency:
            return NotImplemented
        return Money(self.amount + other.amount, self.currency)

    def __eq__(self, other):
        return isinstance(other, Money) and self.amount == other.amount and self.currency == other.currency
\`\`\`
- \`@classmethod\` empfängt \`cls\` und erzeugt abgeleitete Subklassen typkorrekt.
- Operatorüberladung (\`__add__\`, \`__eq__\`) integriert eigene Datentypen nativ in die Sprache.

## Expert: Vertragserzwingung mit ABCs und Speicheroptimierung mit __slots__
Produktionsarchitekturen verlangen nach klaren Verträgen und Ressourceneffizienz:

### 1. Abstrakte Basisklassen (ABCs)
Mit \`abc.ABC\` werden Schnittstellenverträge zur Laufzeit erzwungen:
\`\`\`python
from abc import ABC, abstractmethod

class EventPublisher(ABC):
    @abstractmethod
    def publish(self, topic: str, payload: dict) -> None:
        pass
\`\`\`
Subklassen müssen alle abstrakten Methoden implementieren, bevor Instanzen erzeugt werden können.

### 2. Speicheroptimierung mit __slots__
Standardmäßig speichert jedes Python-Objekt seine Attribute in einem internen Dictionary (\`__dict__\`), was ca. 150-200 Bytes Overhead pro Objekt erzeugt:
\`\`\`python
class CompactRecord:
    __slots__ = ("id", "timestamp", "value")
    def __init__(self, id, timestamp, value):
        self.id = id
        self.timestamp = timestamp
        self.value = value
\`\`\`
\`__slots__\` eliminiert das Instanz-Dictionary und nutzt feste C-Struct-Offsets. Bei Millionen Datensätzen spart dies bis zu 60% RAM.`,

  },
  levels: {
    'oop-class-instance': {
      name: 'Klasse und Instanz',
      brief: 'Instanziiere `bot = Robot()`. Beobachte die Klassendefinition und das neu erzeugte Instanz-Objekt auf dem Heap.',
      learning: [
        'Eine Klasse ist ein Bauplan; ihr Aufruf erzeugt eine neue Instanz auf dem Heap',
        'Jede Instanz besitzt eine eindeutige Identität und Adresse',
      ],
      fieldNotes: [
        'Klassen selbst sind erstklassige Objekte auf dem Heap in Python',
        'Leere Klassen mit pass werden häufig als benutzerdefinierte Ausnahmen verwendet',
      ],
      lesson: 'Eine **Klasse** ist ein Bauplan und eine **Instanz** das daraus erzeugte konkrete Objekt. Beim Aufruf von `Robot()` allokiert Python ein neues Instanz-Objekt auf dem Heap.',
    },
    'oop-init-attributes': {
      name: 'Initialisierung mit __init__',
      brief: 'Erzeuge `p = Point(3, 4)` und berechne `dist_sum = p.x + p.y`. Sieh, wie `self` Attribute an die Instanz bindet.',
      learning: [
        '__init__ initialisiert den Zustand der neu erzeugten Instanz',
        'self verweist auf die spezifische Instanz, die initialisiert wird',
      ],
      fieldNotes: [
        '__init__ muss immer None zurückgeben, andernfalls wird ein TypeError ausgelöst',
        'Instanzattribute werden im internen Wörterbuch (__dict__) gespeichert',
      ],
      lesson: 'Die Methode `__init__` ist der Konstruktor in Python. Bei `Point(3, 4)` wird die Instanz als `self` übergeben und `self.x = x` weist das Attribut dem Instanz-Dictionary zu.',
    },
    'oop-methods-self': {
      name: 'Methoden und Kapselung',
      brief: 'Erzeuge `c = Counter()` und rufe `val = c.increment(5)` auf, um den inneren Zustand der Instanz zu verändern.',
      learning: [
        'Methoden erhalten die aufrufende Instanz automatisch als self',
        'c.method(arg) ist syntaktischer Zucker für Class.method(c, arg)',
      ],
      fieldNotes: [
        'Methoden kapseln den internen Zustand und schützen Objekt-Invarianten',
        'Vermeide es, Zustand außerhalb von self ohne triftigen Grund zu mutieren',
      ],
      lesson: 'Eine Methode ist eine in einer Klasse definierte Funktion. Der Aufruf `c.increment(5)` wird intern zu `Counter.increment(c, 5)` übersetzt, wobei `c` als `self` übergeben wird.',
    },
    'oop-inheritance-super': {
      name: 'Vererbung und super()',
      brief: 'Erzeuge `car = ElectricCar("Tesla", 75)` und rufe `msg = car.start()` auf. Sieh die Vererbung und Weiterleitung an den Basiskonstruktor.',
      learning: [
        'Subklassen erben Attribute und Methoden von Basisklassen',
        'super() delegiert Methodenaufrufe entlang der Method Resolution Order (MRO)',
      ],
      fieldNotes: [
        'Komposition ist in Produktivsystemen oft tiefer Vererbung vorzuziehen',
        'super() gewährleistet kooperative Mehrfachvererbung in Python',
      ],
      lesson: 'Durch Vererbung übernimmt `ElectricCar` Methoden und Attribute der Basisklasse `Vehicle`. `super().__init__(brand)` delegiert die Initialisierung an die Elternklasse.',
    },
    'oop-class-vs-instance': {
      name: 'Klassenattribute vs. Instanzattribute',
      brief: 'Erzeuge `a1 = Account("Alice", 100)` und `a2 = Account("Bob", 200)`. Überschreibe `a1.rate = 0.07` und prüfe `is_shared = (Account.rate == a2.rate)`.',
      learning: [
        'Klassenattribute werden auf dem Klassenobjekt gespeichert und geteilt',
        'Zuweisungen an instance.attr erzeugen ein instanzlokales Attribut, das das Klassenattribut überdeckt',
      ],
      fieldNotes: [
        'Mutationen an veränderlichen Klassenattributen betreffen alle Instanzen',
        'Klassenattribute eignen sich für Konstanten oder Zähler, Instanzattribute für Objektdaten',
      ],
      lesson: 'Klassenattribute wie `rate = 0.05` liegen auf dem Klassenobjekt selbst. Die Zuweisung `a1.rate = 0.07` erzeugt ein instanzlokales Attribut, das das Klassenattribut ausschließlich für `a1` überdeckt.',
    },

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
    'oop-repr-str': {
      name: 'Repräsentation vs. Anzeige: __repr__ und __str__',
      brief: 'Erstelle `u = User("ada", "admin")`. Berechne `display = str(u)` und `debug = repr(u)`. Sieh, wie `__str__` auf Lesbarkeit und `__repr__` auf präzise Diagnose ausgelegt ist.',
      learning: [
        '__str__ liefert menschenlesbaren Text für print() und str()',
        '__repr__ liefert eindeutige Diagnose-Darstellung für Entwickler',
        'Python nutzt __repr__ als Fallback, wenn __str__ fehlt',
      ],
      fieldNotes: [
        'Nutze in Logs %r oder {!r}, um gezielt __repr__ aufzurufen',
        'Ein gutes __repr__ erfüllt idealerweise eval(repr(obj)) == obj',
      ],
      lesson: 'Python trennt zwischen benutzerfreundlicher Anzeige (`__str__`) und eindeutiger Entwickler-Diagnose (`__repr__`).',
    },
    'oop-property-encapsulation': {
      name: 'Kapselung mit @property und Setter-Validierung',
      brief: 'Erzeuge `t = Temperature(25)`, setze `t.celsius = 30` und lies `reading = t.celsius`. Beobachte, wie der Attributzugriff Validierungen ohne Methodenaufrufe ausführt.',
      learning: [
        '@property ermöglicht Getter-Verhalten mit regulärer Punktsyntax',
        '@<name>.setter validiert Werte bei Zuweisungen',
        'Erhält die Kompatibilität der öffentlichen API',
      ],
      fieldNotes: [
        'Ein führender Unterstrich (_celsius) signalisiert internen Zustand',
        'Verwende @property nur für schnelle Zugriffe, nicht für teure Berechnungen',
      ],
      lesson: 'Mit `@property` und `@celsius.setter` lassen sich Validierungen transparent hinter gewöhnlichen Attributzugriffen hinterlegen.',
    },
    'oop-classmethod-factory': {
      name: 'Factory-Konstruktoren mit @classmethod und @staticmethod',
      brief: 'Erzeuge `cfg = Config.from_dict({"host": "localhost", "port": 8080})` und prüfe den Port mit `valid = Config.is_valid_port(cfg.port)`.',
      learning: [
        '@classmethod nimmt cls entgegen und dient als alternativer Konstruktor',
        '@staticmethod kapselt Hilfsfunktionen im Namensraum der Klasse',
        'Factory-Methoden mit cls instanziieren Subklassen polymorph korrekt',
      ],
      fieldNotes: [
        'Typische Namenskonventionen sind from_dict, from_json oder from_env',
        'Statische Methoden ohne Klassenbezug sind oft als Modulfunktion lesbarer',
      ],
      lesson: '`@classmethod` ermöglicht alternative Konstruktoren über das Klassenobjekt (`cls`), während `@staticmethod` reine Hilfsfunktionen bündelt.',
    },
    'oop-operator-overloading': {
      name: 'Operatorüberladung und Wertegleichheit',
      brief: 'Addiere Vektoren `v3 = v1 + v2` und prüfe `is_equal = (v3 == Vector(6, 8))`. Beobachte, wie Dunder-Methoden Sprachoperatoren für eigene Datentypen freischalten.',
      learning: [
        '__add__ implementiert benutzerdefinierte Additionslogik für +',
        '__eq__ ersetzt standardmäßigen Identitätsvergleich durch Wertegleichheit',
        'Duck Typing ermöglicht nahtlose polymorphe Interoperabilität',
      ],
      fieldNotes: [
        'Bei Implementierung von __eq__ sollte für Sets/Dicts auch __hash__ bedacht werden',
        'Gebe NotImplemented zurück, wenn fremde Typen nicht unterstützt werden',
      ],
      lesson: 'Das Python-Datenmodell erlaubt über Dunder-Methoden (`__add__`, `__eq__`) die vollständige Integration eigener Typen in Sprachoperatoren.',
    },
    'oop-abstract-protocol': {
      name: 'Abstrakte Basisklassen und Schnittstellenverträge',
      brief: 'Erzeuge `repo = InMemoryRepo()`, speichere Daten mit `repo.set("session", "active")` und lies `item = repo.get("session")`. Sieh, wie `Repository(ABC)` Methoden vorschreibt.',
      learning: [
        'abc.ABC verhindert die Instanziierung unvollständiger Klassen',
        'Erzwingt explizite Architekturverträge zwischen Modulen',
        'Entkoppelt Anwendungslogik von konkreten Speicher- oder Netzwerkdiensten',
      ],
      fieldNotes: [
        'Instanziierungsversuche ohne abstrakte Methoden werfen TypeError',
        'Abstrakte Methoden können Basisimplementierungen für super() enthalten',
      ],
      lesson: 'Abstrakte Basisklassen (`abc.ABC`) erzwingen verbindliche Schnittstellenverträge zur Laufzeit und verhindern unvollständige Subklassen.',
    },

  },
};
