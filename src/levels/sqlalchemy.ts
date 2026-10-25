/**
 * Series: SQLAlchemy ORM & The Identity Map.
 *
 * Runs in the Pyodide lane with real SQLAlchemy 2.x and in-memory SQLite.
 * Explores declarative models, relationships, session lifecycles, and the ORM identity map.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'sqlalchemy',
    title: 'SQLAlchemy & Identity Map',
    levels: [
      {
        id: 'sqlalchemy-declarative-model',
        eli: 'eli5',
        name: 'Declarative ORM model',
        brief: 'Define a declarative `Item` model with `id` and `name` columns.',
        hint: 'from sqlalchemy import Column, Integer, String\nfrom sqlalchemy.orm import declarative_base\nBase = declarative_base()\nclass Item(Base):\n    __tablename__ = "items"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)',
        start: '',
        par: 7,
        difficulty: 1,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { Base: { type: 'DeclarativeMeta' } } },
        solution: 'from sqlalchemy import Column, Integer, String\nfrom sqlalchemy.orm import declarative_base\nBase = declarative_base()\nclass Item(Base):\n    __tablename__ = "items"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)',
        lesson: `**SQLAlchemy** is Python's premier Object Relational Mapper (ORM).
The Declarative system maps Python classes directly to relational database tables:
- Class attributes become table columns
- Class instances become database rows

**Look at the Heap:**
The model class is a Python class object on the heap registered with metadata describing its database schema.`,
        learning: [
          'SQLAlchemy ORM maps Python classes to relational database tables',
          'declarative_base() provides metadata registry for ORM mapping',
        ],
        fieldNotes: [
          'SQLAlchemy 2.0 supports modern Mapped[T] and mapped_column() type annotations',
          'Class definitions are metadata blueprints; table creation happens via create_all()',
        ],
      },
      {
        id: 'sqlalchemy-memory-session',
        eli: 'eli10',
        name: 'In-memory engine and session',
        brief: 'Create an in-memory SQLite engine `create_engine("sqlite:///:memory:")` and bind a `Session = sessionmaker(bind=engine)`. Open `sess = Session()`.',
        hint: 'from sqlalchemy import create_engine\nfrom sqlalchemy.orm import sessionmaker\nengine = create_engine("sqlite:///:memory:")\nSession = sessionmaker(bind=engine)\nsess = Session()',
        start: '',
        par: 5,
        difficulty: 2,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { sess: { type: 'Session' } } },
        solution: 'from sqlalchemy import create_engine\nfrom sqlalchemy.orm import sessionmaker\nengine = create_engine("sqlite:///:memory:")\nSession = sessionmaker(bind=engine)\nsess = Session()',
        lesson: `The **Engine** manages database connections and SQL dialect compilation. \`"sqlite:///:memory:"\` runs entirely in RAM without touching the filesystem.

The **Session** represents an active conversation with the database, coordinating Unit-of-Work transactions.`,
        learning: [
          'Engine connects Python to database drivers (SQLite, PostgreSQL, MySQL)',
          'Session manages transactions and tracks object persistence state',
        ],
        fieldNotes: [
          'In-memory SQLite databases are fast and ideal for unit testing',
          'Always close sessions or manage them via context managers: with Session() as session:',
        ],
      },
      {
        id: 'sqlalchemy-add-query',
        eli: 'eli15',
        name: 'Add and query records',
        brief: 'Create table, add a new `Item(id=1, name="Widget")`, commit, and query `first = sess.query(Item).first()`.',
        hint: 'from sqlalchemy import create_engine, Column, Integer, String\nfrom sqlalchemy.orm import declarative_base, sessionmaker\nBase = declarative_base()\nclass Item(Base):\n    __tablename__ = "items"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)\nengine = create_engine("sqlite:///:memory:")\nBase.metadata.create_all(engine)\nSession = sessionmaker(bind=engine)\nsess = Session()\nitem = Item(id=1, name="Widget")\nsess.add(item)\nsess.commit()\nfirst = sess.query(Item).first()',
        start: '',
        par: 16,
        difficulty: 3,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { first: { type: 'Item' } } },
        solution: 'from sqlalchemy import create_engine, Column, Integer, String\nfrom sqlalchemy.orm import declarative_base, sessionmaker\nBase = declarative_base()\nclass Item(Base):\n    __tablename__ = "items"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)\nengine = create_engine("sqlite:///:memory:")\nBase.metadata.create_all(engine)\nSession = sessionmaker(bind=engine)\nsess = Session()\nitem = Item(id=1, name="Widget")\nsess.add(item)\nsess.commit()\nfirst = sess.query(Item).first()',
        lesson: `When you call \`sess.add(item)\`, the object enters the session's pending state. Calling \`sess.commit()\` emits an \`INSERT\` statement and commits the transaction.

Querying records executes a \`SELECT\` statement, translating database rows back into Python model instances on the heap.`,
        learning: [
          'sess.add() attaches a new instance to the transaction',
          'sess.commit() flushes pending changes to the database and commits',
        ],
        fieldNotes: [
          'SQLAlchemy automatically coordinates batched inserts to minimize network trips',
          'sess.rollback() discards pending changes and rolls back to transaction start',
        ],
      },
      {
        id: 'sqlalchemy-foreign-key',
        eli: 'eli20',
        name: 'Foreign keys and relationships',
        brief: 'Define models with a ForeignKey and relationship: `Author` has `posts = relationship("Post")`. Instantiate an author.',
        hint: 'from sqlalchemy import create_engine, Column, Integer, String, ForeignKey\nfrom sqlalchemy.orm import declarative_base, relationship\nBase = declarative_base()\nclass Author(Base):\n    __tablename__ = "authors"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)\n    posts = relationship("Post", back_populates="author")\nclass Post(Base):\n    __tablename__ = "posts"\n    id = Column(Integer, primary_key=True)\n    title = Column(String)\n    author_id = Column(Integer, ForeignKey("authors.id"))\n    author = relationship("Author", back_populates="posts")\na = Author(name="Alice")',
        start: '',
        par: 15,
        difficulty: 4,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { a: { type: 'Author' } } },
        solution: 'from sqlalchemy import create_engine, Column, Integer, String, ForeignKey\nfrom sqlalchemy.orm import declarative_base, relationship\nBase = declarative_base()\nclass Author(Base):\n    __tablename__ = "authors"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)\n    posts = relationship("Post", back_populates="author")\nclass Post(Base):\n    __tablename__ = "posts"\n    id = Column(Integer, primary_key=True)\n    title = Column(String)\n    author_id = Column(Integer, ForeignKey("authors.id"))\n    author = relationship("Author", back_populates="posts")\na = Author(name="Alice")',
        lesson: `\`ForeignKey("authors.id")\` establishes database-level relational constraints.
\`relationship()\` tells SQLAlchemy to manage reference navigation in Python:
- \`author.posts\`: Returns a collection of Post objects
- \`post.author\`: Returns the parent Author object

**Look at the Memory Board:**
The ORM constructs bidirectional reference edges between models on the heap.`,
        learning: [
          'ForeignKey defines column-level relational constraints',
          'relationship() configures automatic Python object reference navigation',
        ],
        fieldNotes: [
          'lazy="selectin" or joinedload prevents the classic N+1 query performance bug',
          'cascade="all, delete-orphan" propagates parent deletions to child rows',
        ],
      },
      {
        id: 'sqlalchemy-identity-map',
        eli: 'eliphd',
        name: 'The ORM identity map pattern',
        brief: 'Query the same record twice: `u1 = sess.query(Item).get(1)` and `u2 = sess.query(Item).get(1)`. Prove `is_same = (u1 is u2)`.',
        hint: 'from sqlalchemy import create_engine, Column, Integer, String\nfrom sqlalchemy.orm import declarative_base, sessionmaker\nBase = declarative_base()\nclass Item(Base):\n    __tablename__ = "items"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)\nengine = create_engine("sqlite:///:memory:")\nBase.metadata.create_all(engine)\nSession = sessionmaker(bind=engine)\nsess = Session()\nsess.add(Item(id=1, name="Tool"))\nsess.commit()\nu1 = sess.get(Item, 1)\nu2 = sess.get(Item, 1)\nis_same = (u1 is u2)',
        start: '',
        par: 17,
        difficulty: 5,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { is_same: { type: 'bool', repr: 'True' } } },
        solution: 'from sqlalchemy import create_engine, Column, Integer, String\nfrom sqlalchemy.orm import declarative_base, sessionmaker\nBase = declarative_base()\nclass Item(Base):\n    __tablename__ = "items"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)\nengine = create_engine("sqlite:///:memory:")\nBase.metadata.create_all(engine)\nSession = sessionmaker(bind=engine)\nsess = Session()\nsess.add(Item(id=1, name="Tool"))\nsess.commit()\nu1 = sess.get(Item, 1)\nu2 = sess.get(Item, 1)\nis_same = (u1 is u2)',
        lesson: `**The Core Thesis of learn-python in Practice:**
When querying the database for a row that has already been loaded into the session, SQLAlchemy does NOT create a duplicate object.

Instead, SQLAlchemy consults its internal **Identity Map** (keyed by \`(ModelClass, primary_key)\`), finds the existing instance in memory, and returns the exact same object reference!

\`u1 is u2\` evaluates to \`True\`. There is only one instance on the heap representing database row #1. If you modify \`u1.name = "Updated"\`, \`u2.name\` is immediately updated because they are aliases for the identical object.`,
        learning: [
          'SQLAlchemy uses an Identity Map to guarantee exactly one object per database row',
          'Repeated queries for the same primary key return identical heap object references',
        ],
        fieldNotes: [
          'The identity map prevents divergent in-memory state for the same database row',
          'Sessions are NOT thread-safe; each thread or async request must use its own session',
        ],
      },
    ],
    deepLesson: `## Beginner: The ORM Concept
An Object Relational Mapper (ORM) maps database tables to classes and table rows to objects.
Instead of writing raw SQL strings:
\`\`\`sql
SELECT * FROM users WHERE id = 1;
\`\`\`
You interact with Python objects:
\`\`\`python
user = session.get(User, 1)
print(user.name)
\`\`\`

## Intermediate: Engine vs Session
- **Engine:** The low-level connection pool and dialect translator. It talks to database sockets and drivers.
- **Session:** The high-level Unit of Work. It tracks changes to Python objects and batches SQL statements during transactions.

## Advanced: Relationships and Loading Strategies
Database relationships require careful query planning to avoid performance degradation:
- **Lazy Loading (default):** Related objects are queried on first attribute access (causes N+1 query problems).
- **Eager Loading:** Queries child records simultaneously using \`joinedload\` or \`selectinload\`.

## Expert: The Identity Map and Unit of Work
The Identity Map is a fundamental design pattern:
1. Every loaded database entity is registered by its primary key in \`session.identity_map\`.
2. Any query for that entity returns the existing in-memory reference.
3. Therefore:
\`\`\`python
a = session.get(User, 1)
b = session.get(User, 1)
assert a is b  # True! Identical heap object
\`\`\`
This ensures zero duplicate objects and guarantees that in-memory mutations remain consistent across your application.`,
  },
];
