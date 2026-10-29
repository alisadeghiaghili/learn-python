/**
 * Series: Object-Oriented Programming (OOP).
 *
 * Explores classes as blueprints, heap instance allocation, constructor __init__,
 * methods and self binding, inheritance with super(), and class vs instance attributes.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'oop',
    title: 'Object-Oriented Programming',
    levels: [
      {
        id: 'oop-class-instance',
        eli: 'eli5',
        name: 'A class and its instance',
        brief: 'Instantiate `bot = Robot()`. Observe the class definition and the new instance object created on the heap.',
        hint: 'bot = Robot()',
        start: 'class Robot:\n    pass',
        par: 1,
        difficulty: 1,
        goal: { type: 'vars', vars: { bot: { type: 'instance' } } },
        solution: 'bot = Robot()',
        lesson: `A **class** is a blueprint, and an **instance** is a concrete object created from that blueprint.

When you define \`class Robot:\`, Python allocates a class object on the heap. Calling \`Robot()\` constructs a fresh instance.

**Look at the Heap:**
The variable \`bot\` holds an amber reference arrow pointing to the \`<Robot object>\`. Calling \`Robot()\` again would allocate a second, completely distinct instance with its own address and identity!`,
        learning: [
          'A class is a blueprint; calling it creates a new instance on the heap',
          'Every instance has a unique identity and address',
        ],
        fieldNotes: [
          'Classes themselves are first-class heap objects in Python',
          'Empty classes with pass are commonly used for custom exception hierarchies',
        ],
      },
      {
        id: 'oop-init-attributes',
        eli: 'eli10',
        name: 'Initialization with __init__',
        brief: 'Instantiate `p = Point(3, 4)` and compute `dist_sum = p.x + p.y`. Observe how `self` assigns attributes to the instance.',
        hint: 'p = Point(3, 4)\ndist_sum = p.x + p.y',
        start: 'class Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y',
        par: 2,
        difficulty: 2,
        goal: { type: 'vars', vars: { dist_sum: { type: 'int', repr: '7' } } },
        solution: 'p = Point(3, 4)\ndist_sum = p.x + p.y',
        lesson: `The \`__init__\` method is Python's instance initializer (constructor).

When you call \`Point(3, 4)\`:
1. Python creates a fresh instance box on the heap.
2. Python executes \`__init__\`, passing the new instance as \`self\`, alongside \`3\` and \`4\`.
3. \`self.x = x\` attaches the attribute \`x\` directly to this instance's dictionary.

**Look at the Memory Board:**
Notice the instance on the heap contains fields \`{ x: 3, y: 4 }\`. Each instance maintains its own independent attribute values.`,
        learning: [
          '__init__ initializes state on the newly created instance',
          'self refers to the specific instance currently being initialized',
        ],
        fieldNotes: [
          '__init__ must always return None; returning a value raises a TypeError',
          'Instance attributes are stored in the instance internal dictionary (__dict__)',
        ],
      },
      {
        id: 'oop-methods-self',
        eli: 'eli15',
        name: 'Methods and encapsulated behavior',
        brief: 'Instantiate `c = Counter()` and call `val = c.increment(5)` to mutate internal instance state.',
        hint: 'c = Counter()\nval = c.increment(5)',
        start: 'class Counter:\n    def __init__(self):\n        self.count = 0\n    def increment(self, step=1):\n        self.count += step\n        return self.count',
        par: 2,
        difficulty: 3,
        goal: { type: 'vars', vars: { val: { type: 'int', repr: '5' } } },
        solution: 'c = Counter()\nval = c.increment(5)',
        lesson: `A **method** is a function defined inside a class that operates on an instance.

When you write \`c.increment(5)\`, Python translates this behind the scenes to:
\`Counter.increment(c, 5)\`

The instance \`c\` is passed automatically as the first parameter, \`self\`.

**Look at the Mutation:**
Calling \`increment(5)\` mutates \`self.count\` directly inside \`c\`'s heap box from \`0\` to \`5\` in place. Methods encapsulate data and the operations that safely transform that data.`,
        learning: [
          'Methods receive the calling instance automatically as self',
          'c.method(arg) is syntactic sugar for Class.method(c, arg)',
        ],
        fieldNotes: [
          'Methods encapsulate internal state and maintain object invariants',
          'Avoid mutating state outside self without explicit intent',
        ],
      },
      {
        id: 'oop-inheritance-super',
        eli: 'eli20',
        name: 'Inheritance and super()',
        brief: 'Instantiate `car = ElectricCar("Tesla", 75)` and call `msg = car.start()`. Observe inheritance and constructor delegation.',
        hint: 'car = ElectricCar("Tesla", 75)\nmsg = car.start()',
        start: 'class Vehicle:\n    def __init__(self, brand):\n        self.brand = brand\n    def start(self):\n        return self.brand + " engine started"\n\nclass ElectricCar(Vehicle):\n    def __init__(self, brand, battery_kwh):\n        super().__init__(brand)\n        self.battery_kwh = battery_kwh',
        par: 2,
        difficulty: 4,
        goal: { type: 'vars', vars: { msg: { type: 'str', repr: "'Tesla engine started'" } } },
        solution: 'car = ElectricCar("Tesla", 75)\nmsg = car.start()',
        lesson: `**Inheritance** allows a subclass (\`ElectricCar\`) to inherit attributes and methods from a base class (\`Vehicle\`).

In \`ElectricCar.__init__\`, \`super().__init__(brand)\` invokes the parent class constructor, initializing \`self.brand\` without duplicate code.

When \`car.start()\` is called, Python searches for \`start\` on \`ElectricCar\`. Finding none, it walks up the inheritance chain to \`Vehicle\` and executes it with \`self\` bound to \`car\`.`,
        learning: [
          'Subclasses inherit attributes and methods from base classes',
          'super() delegates method calls along the Method Resolution Order (MRO)',
        ],
        fieldNotes: [
          'Prefer composition over deep inheritance hierarchies in production systems',
          'super() ensures proper cooperative multiple inheritance in Python',
        ],
      },
      {
        id: 'oop-class-vs-instance',
        eli: 'eliphd',
        name: 'Class attributes vs instance attributes',
        brief: 'Instantiate `a1 = Account("Alice", 100)` and `a2 = Account("Bob", 200)`. Override `a1.rate = 0.07` and verify `is_shared = (Account.rate == a2.rate)`.',
        hint: 'a1 = Account("Alice", 100)\na2 = Account("Bob", 200)\na1.rate = 0.07\nis_shared = (Account.rate == a2.rate)',
        start: 'class Account:\n    rate = 0.05\n    def __init__(self, owner, balance):\n        self.owner = owner\n        self.balance = balance',
        par: 4,
        difficulty: 5,
        goal: { type: 'vars', vars: { is_shared: { type: 'bool', repr: 'True' } } },
        solution: 'a1 = Account("Alice", 100)\na2 = Account("Bob", 200)\na1.rate = 0.07\nis_shared = (Account.rate == a2.rate)',
        lesson: `Python distinguishes between **class attributes** and **instance attributes**:

1. \`rate = 0.05\` defined in the class body belongs to the class object itself on the heap.
2. When reading \`a2.rate\`, Python checks \`a2\`'s instance dictionary. Finding no \`rate\`, it falls back to \`Account.rate\` (both equal \`0.05\`).
3. When assigning \`a1.rate = 0.07\`, Python creates an attribute in \`a1\`'s private instance dictionary, *shadowing* the class attribute for \`a1\` only!

\`Account.rate\` and \`a2.rate\` remain \`0.05\`, while \`a1.rate\` is \`0.07\`. Understanding this namespace separation prevents critical shared-state bugs.`,
        learning: [
          'Class attributes are stored on the class object and shared across instances',
          'Assigning to instance.attr shadows the class attribute on that specific instance',
        ],
        fieldNotes: [
          'Mutating a mutable class attribute (like cls.items.append(x)) alters state for all instances',
          'Use class attributes for constants, defaults, or counters; use instance attributes for per-object state',
        ],
      },
    ],
    deepLesson: `## Beginner: The Class as a Blueprint and Objects on the Heap
A class defines a blueprint for data structure and behavior.
When you call \`cls()\`, Python allocates a new instance on the heap:
\`\`\`python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

p1 = Point(1, 2)
p2 = Point(1, 2)
print(p1 is p2)  # False: two distinct heap objects!
\`\`\`
Each instance has its own memory address, reference count, and attribute dictionary.

## Intermediate: The Lifecycle of an Instance and __init__
When an object is instantiated:
1. \`__new__()\` allocates the raw instance object on the heap.
2. \`__init__()\` initializes the instance's fields with \`self\`.
3. The instance reference is returned to the caller.

\`self\` is not a keyword in Python; it is an explicit parameter naming the current instance.

## Advanced: Method Binding, Encapsulation, and Inheritance
Methods encapsulate behavior with state:
\`\`\`python
class Animal:
    def sound(self):
        return "generic"

class Dog(Animal):
    def sound(self):
        return "woof"
\`\`\`
When \`d = Dog()\` calls \`d.sound()\`, Python binds the function to the instance, producing a bound method where \`self\` is permanently bound to \`d\`.

Subclasses inherit parent methods and can override them, or invoke the base implementation via \`super()\`.

## Expert: Attribute Resolution Order, Namespace Shadowing, and MRO
Attribute lookup in Python follows a strict protocol:
1. Check the instance dictionary (\`inst.__dict__\`).
2. If not found, check the class dictionary (\`type(inst).__dict__\`).
3. If not found, walk the class's **Method Resolution Order (MRO)** across its base classes.
4. If still not found, invoke \`__getattr__()\` if defined, or raise \`AttributeError\`.

Assigning to \`inst.attr = val\` writes to step 1 (\`inst.__dict__\`), which shadows any class attribute of the same name without mutating the class object.`,
  },
];
