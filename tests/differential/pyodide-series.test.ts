/**
 * Phase 10 extended curricula probes tested differentially against CPython >= 3.12.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { findPython, runPython } from './cpython';

describe('Phase 10 — Differential probes for extended curricula against CPython', () => {
  const py = findPython();

  beforeAll(() => {
    if (!py) {
      console.warn('Skipping CPython differential suite: CPython >= 3.12 not found.');
    }
  });

  const testProbe = (name: string, code: string, expectedStdout?: string) => {
    const runner = py ? it : it.skip;
    runner(name, async () => {
      const res = await runPython(code);
      expect(res.errorType).toBeNull();
      if (expectedStdout !== undefined) {
        expect(res.stdout.trim()).toBe(expectedStdout.trim());
      }
    });
  };

  describe('10.1 Slicing semantics', () => {
    testProbe('list slice copy independence', `
xs = [1, 2, 3]
sub = xs[1:]
sub.append(99)
print(xs, sub)
`, '[1, 2, 3] [2, 3, 99]');

    testProbe('step stride and negative reverse', `
xs = [0, 1, 2, 3, 4]
print(xs[::2], xs[::-1])
`, '[0, 2, 4] [4, 3, 2, 1, 0]');

    testProbe('in-place slice assignment', `
xs = [1, 2, 3, 4]
xs[1:3] = [20, 30]
print(xs)
`, '[1, 20, 30, 4]');
  });

  describe('10.2 Recursion and call frames', () => {
    testProbe('recursive factorial', `
def fact(n):
    return 1 if n <= 1 else n * fact(n - 1)
print(fact(5))
`, '120');

    testProbe('recursive accumulator pattern', `
def acc_sum(n, acc=0):
    return acc if n <= 0 else acc_sum(n - 1, acc + n)
print(acc_sum(4, 0))
`, '10');
  });

  describe('10.3 Closures and generators', () => {
    testProbe('closure state capture', `
def make_counter():
    n = 0
    def inc():
        nonlocal n
        n += 1
        return n
    return inc
c = make_counter()
print(c(), c())
`, '1 2');

    testProbe('generator function yield', `
def gen():
    yield 1
    yield 2
g = gen()
print(next(g), next(g))
`, '1 2');
  });

  describe('10.4 Regular expressions', () => {
    testProbe('re compile, search, groups', `
import re
p = re.compile(r'(\\w+)@(\\w+\\.\\w+)')
m = p.search('contact alice@test.org now')
print(m.group(1), m.group(2))
`, 'alice test.org');

    testProbe('re.sub replacement', `
import re
clean = re.sub(r'\\s+', '-', 'a  b   c')
print(clean)
`, 'a-b-c');
  });

  describe('10.5 Typing and Pydantic', () => {
    testProbe('pydantic model validation and coercion', `
from pydantic import BaseModel
class User(BaseModel):
    id: int
    name: str
u = User(id='42', name='Alice')
print(u.id, type(u.id).__name__, u.name)
`, '42 int Alice');
  });

  describe('10.6 SQLAlchemy ORM identity map', () => {
    testProbe('SQLAlchemy identity map: u1 is u2', `
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()
class Item(Base):
    __tablename__ = 'items'
    id = Column(Integer, primary_key=True)
    name = Column(String)

engine = create_engine('sqlite:///:memory:')
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
sess = Session()
sess.add(Item(id=1, name='Tool'))
sess.commit()

u1 = sess.get(Item, 1)
u2 = sess.get(Item, 1)
print(u1 is u2, u1.name)
`, 'True Tool');
  });

  describe('10.7 Production FastAPI and TestClient', () => {
    testProbe('FastAPI endpoint tested with TestClient', `
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

app = FastAPI()
def get_status():
    return {'status': 'healthy'}

@app.get('/health')
def health(data = Depends(get_status)):
    return data

client = TestClient(app)
res = client.get('/health')
print(res.status_code, res.json()['status'])
`, '200 healthy');
  });
});
