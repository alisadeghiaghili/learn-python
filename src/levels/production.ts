/**
 * Series: Production Architecture & FastAPI.
 *
 * Runs in the Pyodide lane with real FastAPI, httpx TestClient, and logging.
 * Explores 12-factor env configuration, structured logging, FastAPI endpoints, and dependency injection.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'production',
    title: 'Production & Architecture',
    levels: [
      {
        id: 'prod-env-vars',
        eli: 'eli5',
        name: '12-factor environment configuration',
        brief: 'Read an environment variable using `os.environ.get("APP_ENV", "production")` and assign to `env`.',
        hint: 'import os\nenv = os.environ.get("APP_ENV", "production")',
        start: '',
        par: 2,
        difficulty: 1,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { env: { type: 'str', repr: "'production'" } } },
        solution: 'import os\nenv = os.environ.get("APP_ENV", "production")',
        lesson: `The **Twelve-Factor App** methodology mandates strict separation of configuration from code.
Configuration that varies between deployments (staging, production, test) must be stored in environment variables.

In Python, \`os.environ.get(key, default)\` reads environment variables safely with fallback defaults.`,
        learning: [
          'Environment variables separate runtime configuration from source code',
          'os.environ.get() provides safe lookups with fallback defaults',
        ],
        fieldNotes: [
          'Never commit secrets, tokens, or credentials to version control',
          'Use pydantic-settings to validate all environment variables at service launch',
        ],
      },
      {
        id: 'prod-logging',
        eli: 'eli10',
        name: 'Structured logging',
        brief: 'Configure basic logging with `import logging; logging.basicConfig(level=logging.INFO); logger = logging.getLogger("app")`.',
        hint: 'import logging\nlogging.basicConfig(level=logging.INFO)\nlogger = logging.getLogger("app")',
        start: '',
        par: 3,
        difficulty: 2,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { logger: { type: 'Logger' } } },
        solution: 'import logging\nlogging.basicConfig(level=logging.INFO)\nlogger = logging.getLogger("app")',
        lesson: `Production services use Python's built-in \`logging\` module instead of raw \`print()\` statements.
Logging provides:
- Standard log levels (\`DEBUG\`, \`INFO\`, \`WARNING\`, \`ERROR\`, \`CRITICAL\`)
- Configurable handlers (console, file, syslog, cloud log aggregators)
- Formatters for structured JSON logs in containerized environments`,
        learning: [
          'logging.getLogger(__name__) creates hierarchical named loggers',
          'Log levels allow filtering diagnostic noise in production',
        ],
        fieldNotes: [
          'In Kubernetes, log directly to stdout/stderr as single-line JSON',
          'Include trace_id and span_id in log records for distributed tracing',
        ],
      },
      {
        id: 'prod-fastapi-app',
        eli: 'eli15',
        name: 'FastAPI application and routing',
        brief: 'Create a FastAPI instance `app = FastAPI()` and define a health route `def health(): return {"status": "ok"}`.',
        hint: 'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/health")\ndef health():\n    return {"status": "ok"}',
        start: '',
        par: 5,
        difficulty: 3,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { app: { type: 'FastAPI' } } },
        solution: 'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/health")\ndef health():\n    return {"status": "ok"}',
        lesson: `**FastAPI** is Python's leading asynchronous web framework.
Route decorators like \`@app.get("/health")\` register URL paths and HTTP methods to handler functions.

FastAPI automatically generates interactive OpenAPI documentation (\`/docs\`) directly from Python function signatures and type hints.`,
        learning: [
          'FastAPI builds high-performance REST APIs powered by Starlette and Pydantic',
          'Route decorators register HTTP method endpoints to Python functions',
        ],
        fieldNotes: [
          'FastAPI runs on ASGI web servers such as Uvicorn or Hypercorn',
          'Handler functions can be synchronous (def) or asynchronous (async def)',
        ],
      },
      {
        id: 'prod-fastapi-client',
        eli: 'eli20',
        name: 'Integration testing with TestClient',
        brief: 'Test the health route using `TestClient(app)`: `res = client.get("/health")` and extract `code = res.status_code`.',
        hint: 'from fastapi import FastAPI\nfrom fastapi.testclient import TestClient\napp = FastAPI()\n@app.get("/health")\ndef health():\n    return {"status": "ok"}\nclient = TestClient(app)\nres = client.get("/health")\ncode = res.status_code',
        start: '',
        par: 9,
        difficulty: 4,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { code: { type: 'int', repr: '200' } } },
        solution: 'from fastapi import FastAPI\nfrom fastapi.testclient import TestClient\napp = FastAPI()\n@app.get("/health")\ndef health():\n    return {"status": "ok"}\nclient = TestClient(app)\nres = client.get("/health")\ncode = res.status_code',
        lesson: `FastAPI provides \`TestClient\` (powered by \`httpx\`) to test API endpoints in-memory without binding actual network sockets.

\`client.get("/health")\` runs the complete ASGI request/response pipeline and returns a response object with status codes, headers, and parsed JSON.`,
        learning: [
          'TestClient executes full HTTP requests against ASGI apps in-memory',
          'Enables instant integration testing without running background server processes',
        ],
        fieldNotes: [
          'TestClient can be packaged into pytest fixtures for clean API test suites',
          'Use res.json() to parse and assert on returned response dictionaries',
        ],
      },
      {
        id: 'prod-dependency-injection',
        eli: 'eliphd',
        name: 'Dependency injection with Depends',
        brief: 'Use `Depends` to inject database state into an endpoint. Verify route execution returns `{"db": "ready"}`.',
        hint: 'from fastapi import FastAPI, Depends\napp = FastAPI()\ndef get_db():\n    return {"db": "ready"}\n@app.get("/data")\ndef get_data(db = Depends(get_db)):\n    return db\nfrom fastapi.testclient import TestClient\nclient = TestClient(app)\ndata = client.get("/data").json()',
        start: '',
        par: 10,
        difficulty: 5,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { data: { type: 'dict' } } },
        solution: 'from fastapi import FastAPI, Depends\nfrom fastapi.testclient import TestClient\napp = FastAPI()\ndef get_db():\n    return {"db": "ready"}\n@app.get("/data")\ndef get_data(db = Depends(get_db)):\n    return db\nclient = TestClient(app)\ndata = client.get("/data").json()',
        lesson: `**Dependency Injection (DI)** decouples route logic from resource management (database sessions, authentication, external clients).

FastAPI's \`Depends()\` tells the framework to execute the dependency function, handle its lifecycle, and pass the resolved instance into the route handler.

In tests, dependencies can be swapped instantly using \`app.dependency_overrides[get_db] = mock_db\`, achieving 100% test isolation.`,
        learning: [
          'Depends() provides clean dependency injection for web services',
          'app.dependency_overrides allows swapping real dependencies with mocks in tests',
        ],
        fieldNotes: [
          'Yield dependencies handle resource cleanup: yield db; db.close()',
          'DI enables clean architectural layers without global singleton state',
        ],
      },
    ],
    deepLesson: `## Beginner: The 12-Factor Philosophy
Building software for cloud deployment (Docker, Kubernetes) requires strict separation of concerns:
- **Codebase:** One codebase tracked in version control, many deploys.
- **Config:** Store configuration in environment variables (\`os.environ\`).
- **Logs:** Treat logs as event streams emitted to stdout.

## Intermediate: Asynchronous Web Architecture with FastAPI
FastAPI leverages modern Python features:
- **Async I/O:** High concurrency without threads or multiprocessing overhead.
- **Type Hints:** Automatic request validation via Pydantic and interactive OpenAPI docs.
- **ASGI:** Standard asynchronous server interface interoperating with Uvicorn and Gunicorn.

## Advanced: Dependency Injection and Testing
Dependency Injection inverts control:
\`\`\`python
from fastapi import FastAPI, Depends

app = FastAPI()

def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/items")
def list_items(db = Depends(get_session)):
    return db.query(Item).all()
\`\`\`
Routes request dependencies by type rather than instantiating them directly.

## Expert: Production Readiness Checklist
Before shipping Python services to production:
1. **Validation at Startup:** Fail fast on missing environment variables.
2. **Graceful Shutdown:** Register lifespan handlers to close database pools and HTTP sessions cleanly.
3. **Health & Readiness Probes:** Expose \`/healthz\` and \`/readyz\` endpoints for container orchestrators.
4. **Structured JSON Logs:** Format all log lines as JSON with timestamp, severity, and context IDs.`,
  },
];
