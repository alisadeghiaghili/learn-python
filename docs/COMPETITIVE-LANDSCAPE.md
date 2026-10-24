# Competitive landscape and positioning

> Status: assessment as of 2026-10-23, against `main` at `d222b36`.
> Review this document whenever a fidelity, UI or curriculum milestone lands, and
> update the "Where learn-python stands" column rather than rewriting history.

## 1. Purpose

This document records how learn-python compares with the tools a Python learner
can already use for free or cheaply, where it is genuinely differentiated, where
it is behind, and what that implies for priorities. It is an engineering input:
the roadmap, ADRs and errata should be traceable to the gaps listed here.

Claims about third-party products were checked against their public pages at the
date above. Anything that could not be confirmed is marked *unverified*. Prices
change often and are indicative only.

## 2. Comparison matrix

| Tool | Price | Real interpreter | Memory-model visual | Goal-checked levels | NumPy / pandas / asyncio / threading | Farsi / German | Runs client-side | AI tutor | Scale |
|---|---|---|---|---|---|---|---|---|---|
| **learn-python** | Free, MIT | No — TypeScript simulator | Stack, heap, RAM map (addresses, sizes, refs), buffer strips for views | Yes, 78 levels with par | All four, simulated | Both | Yes | No | New, no usage data |
| [Python Tutor](https://pythontutor.com/) | Free | Yes (server-side CPython 3.11) | Stack, heap, references; values in cells; step back/forward; current line | No | No (stdlib whitelist, no packages) | *unverified* | No | Reported, details *unverified* | 25M+ users |
| [memory_graph](https://github.com/bterwijn/memory_graph) web debugger | Free, BSD-2 | Yes (Pyodide) | Reference graph, copies, mutability | No | NumPy, pandas yes; concurrency *unverified* | *unverified* | Yes | No | ~1.1k stars |
| [Thonny](https://thonny.org/) | Free | Yes (desktop) | Variables + heap mode | No | No | *unverified* | Desktop | No | Large installed base |
| [futurecoder](https://futurecoder.io/) | Free, MIT | Yes (Pyodide) | Via embedded Python Tutor | Exercises, not memory goals | Basic | No | Yes | No | ~1.5k stars |
| [Exercism Python](https://exercism.org/tracks/python) | Free | Local CPython | No | 146 exercises, mentor review | No | No | CLI | Human mentors | Large |
| [Codecademy](https://www.codecademy.com/learn/learn-python-3) | Freemium | Yes (server) | No | Yes | Limited | German UI | No | Yes | Very large |
| [DataCamp](https://www.datacamp.com/pricing) | Freemium | Yes (server) | No | Yes | pandas/NumPy as API skills | No | No | Yes | 800+ courses |
| [Boot.dev](https://www.boot.dev/) | Paid after intro | Yes | No | Yes | No | No | No | *unverified* | Medium |
| [Quera College](https://quera.org/college/landpage/python) | Paid | Yes | No | 200+ exercises | Python/data courses | Farsi | No | *unverified* | Large (Iran) |
| Faradars / Maktabkhooneh | Mixed | Video | No | No | Video courses | Farsi | No | No | Large (Iran) |
| [openHPI](https://open.hpi.de/) | Free | Yes (browser) | No | Quizzes | No | German | No | No | Medium |
| [learnGitBranching](https://github.com/pcottle/learnGitBranching) (design reference) | Free, MIT | n/a | Git DAG | Yes, with golf, level builder, permalinks | n/a | Multiple locales | Yes | No | ~34k stars |

## 3. Where learn-python is genuinely differentiated

No counterexample was found for any of these at the assessment date:

1. **Goal-checked memory-model challenges.** Python Tutor and memory_graph show
   memory but grade nothing; course platforms grade output but never memory.
   Grading "make these two names share one object" is unique.
2. **An addressed RAM board** with byte sizes and a view painted as a strip over
   its buffer.
3. **One canvas from basics to asyncio, threading and plotting.** Competitors each
   cover one slice.
4. **Free, interactive, Farsi.** Persian options are paid (Quera) or video
   (Faradars, Maktabkhooneh).
5. **Zero backend, static hosting**, which makes a fully offline build possible.
   This matters for learners on unreliable or filtered networks. It is not unique
   by itself (memory_graph's web debugger is also client-side).

## 4. Where learn-python is behind

As of `d222b36` (details and repro steps live in the errata log):

> Status update 2026-10-24 (Phase 1): Differential harness established (`tests/differential/`). 78 level solutions and 67 semantic probes wired against real CPython >= 3.12. 13 levels with invalid CPython syntax/APIs (asyncio `await None`, threading positional `Thread`, bare `scatter`) identified and tracked for Phase 4 remediation; 37 engine discrepancies identified and tracked for Phase 2 engine fixes.
> Status update 2026-10-24 (Phase 2): Evaluator modularized into `builtins/` and `methods/`. Exception hierarchy, small-int interning (-5..256), BigInt arbitrary precision integers, distinct float type, augmented assignment in-place mutations, compile-time local detection, closures, and lambda support implemented. 67/67 Phase 2 differential semantic probes now pass 100% against real CPython.
> Status update 2026-10-24 (Phase 3): Visualizer fidelity upgraded. Scalar values displayed inline with values by default with "Show every object on the heap" toggle. Small-integer interning (-5..256) maps to shared heap boxes with multi-arrow aliasing. RAM board updated with truthful refcounts (including closures) and "References from program: N". Scrubber slider, autoplay (play/pause/0.5x/1x/2x speed), current line highlighting in script editor, live aria accessibility regions, text alternatives, and console keyboard trap resolution (Shift+Tab & Escape un-trap) implemented. Board responsive down to 360 px width and stable at 200% zoom.

| Gap | Best-in-class reference | Consequence |
|---|---|---|
| Not real Python; small grammar (no unpacking, kwargs/defaults, comprehensions, f-strings, classes, exceptions, `not in`) | Python Tutor, futurecoder, memory_graph | Learners hit the subset wall within minutes |
| Semantics that disagree with CPython: `+=` rebinds instead of mutating, function-scope `UnboundLocalError` missing, `NaN` instead of `TypeError`/`ValueError`, string/list comparison wrong, JS-double ints | CPython itself | A memory-model tool that is wrong about identity loses teacher trust immediately |
| pandas taught pre-Copy-on-Write | [pandas 3.0](https://pandas.pydata.org/community/blog/pandas-3.0.html) makes CoW the only mode | The pandas series teaches the opposite of current behaviour |
| asyncio/threading code is not valid CPython (`Thread(f, args)`, `asyncio.run(t1, t2)`, `await None`) | Official docs | Graduates fail on first real use |
| Memory board omits scalar values; no current-line highlight, slider or autoplay; no zoom/pan or collapse | Python Tutor | Loop and binding levels show no visible change while stepping |
| Content volume and depth: 78 short levels, most with the solution in the brief | Exercism (146), Codewars, DataCamp | About 2–3 hours of material |
| Mobile and zoom: canvas clipped at 390 px, board height 0 at 200% zoom | futurecoder, Python Tutor | Unusable on phones, the main device for many target learners |
| Accessibility: keyboard trap in the console, canvas has no text alternative | WCAG 2.2 AA | Excludes keyboard and screen-reader users |
| No AI tutor, community, certificates, permalinks or level builder | Codecademy, DataCamp, learnGitBranching | Weak retention and discoverability |

## 5. Threats

1. **Visualisation is commoditising.** Python Tutor publishes a guide for AI
   assistants to link straight to its visualisations; memory_graph already runs
   NumPy and pandas for real in the browser.
2. **LLM tutors absorb "explain this" questions.** A chat answer plus a Python
   Tutor link covers most single-concept explanations.
3. **Pyodide-based free courses set the floor** for "free interactive Python". A
   simulator must justify itself against real execution.
4. **Library drift.** Every pandas/NumPy/Python change (pandas 3.0 is the example)
   needs a manual engine update, which a simulator-only design cannot sustain.

## 6. Positioning

1. **Own "identity, not syntax".** Aliasing, views vs copies, Copy-on-Write and
   shared state, taught with goal-checked levels. Do not compete as a general
   beginner course.
2. **Fidelity first.** Every level solution and every taught behaviour is
   verified against real CPython in CI (differential tests). The pre-/post-CoW
   pandas contrast becomes a feature, not a liability.
3. **Two execution lanes.** Keep the simulator where step-level visual control
   matters; run library-heavy material (regex, typing/pydantic, pytest,
   SQLAlchemy, FastAPI) on self-hosted Pyodide with the same Memory/RAM boards.
   See the ADR to be written for this decision.
4. **Farsi and offline as the wedge.** Complete Farsi, a Persian web font,
   self-hosted assets and an installable offline PWA, with no dependency on
   CDNs or third-party counters.
5. **Borrow learnGitBranching's growth mechanics.** Permalinks for sandbox
   states, a level builder, shareable par results, and stable deep links that
   teachers and LLMs can cite.

## 7. Success measures

Tracked in this document at each review:

- Status 2026-10-24 (Phase 1): Differential suite active (78/78 level solution probes, 67/67 Phase 2 semantic probes). CI differential step added with Python 3.12 & requirements-dev.txt. Total test suite passing at 283/283 tests.
- Status 2026-10-24 (Phase 2): Evaluator modularization complete. 67/67 Phase 2 differential probes passing against real CPython (100%). Base unit test suite passing at 138/138 tests (100%). Zero TypeScript errors on build.
- Status 2026-10-24 (Phase 3): Visualizer & UI fidelity complete. 147 unit tests passing (100%). Zero TypeScript errors on build. Scrubber, autoplay, scalar heap toggle, accessible text alternative, and responsive layout verified.

- Differential suite: share of level solutions and probes that match CPython (target 100%).
- Grammar coverage against the README's "supported" list (generated from tests).
- axe serious/critical violations across EN/DE/FA (target 0).
- Smallest supported viewport and zoom with a usable board (target 360 px wide, 200% zoom).
- Levels per series, and share of levels whose brief does not contain the solution.
