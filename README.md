# StreamSignal Backend Foundation & Infrastructure (EPIC-0)

Production-ready Docker development environment for **StreamSignal**, featuring:
- **FastAPI** application backend with hot-reload for local development.
- **PostgreSQL 17** database container.
- **PostGIS 3.5** spatial/geographical query extension enabled.
- **pgvector** high-performance vector similarity search extension enabled.
- **Persistent Docker Volume** preserving database data across container restarts.
- **Isolated Internal Docker Network** connecting the backend and database securely.
- **Environment Variable Configuration** driven by `.env` (with `.env.example` template).
- **Automated Healthchecks** for both PostgreSQL and FastAPI services.

---

## Architecture Overview

```
+--------------------------------------------------------------+
|                     Host Machine                             |
|                                                              |
|   +-----------------------+      +-----------------------+   |
|   | Port 8000             |      | Port 5432             |   |
|   +-----------+-----------+      +-----------+-----------+   |
+---------------|------------------------------|---------------+
                |                              |
      +---------v------------------------------v---------+
      |      Docker Network (streamsignal_network)       |
      |                                                  |
      |   +---------------------+                        |
      |   | streamsignal-backend|                        |
      |   |   (FastAPI App)     |                        |
      |   +----------+----------+                        |
      |              | (SQLAlchemy / psycopg2)           |
      |   +----------v----------+                        |
      |   | streamsignal-db     |                        |
      |   |   PostgreSQL 17     |                        |
      |   |   - PostGIS 3.5     |                        |
      |   |   - pgvector        |                        |
      |   +----------+----------+                        |
      |              |                                   |
      +--------------|-----------------------------------+
                     | (Mounts)
      +--------------v-----------------------------------+
      | Persistent Volume: streamsignal_postgres_data    |
      +--------------------------------------------------+
```

---

## Quickstart

### 1. Configure Environment Variables
Copy `.env.example` to `.env` (if not already created):
```bash
cp .env.example .env
```

### 2. Start the Infrastructure
Launch all services in detached mode:
```bash
docker compose up -d
```

Docker Compose will:
1. Build the customized PostgreSQL 17 image containing PostGIS and pgvector.
2. Build the FastAPI backend image with required C-bindings and geospatial libraries.
3. Automatically execute extension enablement scripts (`CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS vector;`).
4. Wait for PostgreSQL to become healthy before starting the backend service.

### 3. Verify Container Status
```bash
docker compose ps
```
You should see:
- `streamsignal-db`: `Up (healthy)`
- `streamsignal-backend`: `Up`

---

## Health Checks & Extension Verification

| Endpoint | Method | Description |
|---|---|---|
| `http://localhost:8000/` | `GET` | Service index & endpoint directory |
| `http://localhost:8000/health` | `GET` | Basic backend service health |
| `http://localhost:8000/health/db` | `GET` | PostgreSQL connectivity, version & extension check |
| `http://localhost:8000/health/extensions/verify` | `GET` | Runs active PostGIS & pgvector queries |
| `http://localhost:8000/docs` | `GET` | Interactive Swagger API documentation |

---

## Running Automated Tests

Run pytest inside the running backend container:
```bash
docker compose exec backend pytest -v
```

---

## Stopping & Teardown

- Stop containers while **preserving data**:
  ```bash
  docker compose down
  ```
- Stop containers and **delete data volume**:
  ```bash
  docker compose down -v
  ```
