# 🌊 StreamSignal — One Health Evidence System
> **IEEE OneAquaHealth Global Hackathon 2026**
> *Citizen Science, Evidence Interoperability & Urban Freshwater Surveillance*

StreamSignal turns a citizen's uncertain urban freshwater observation into a transparent, reviewable, provenance-rich, standards-ready **One Health evidence case**.

---

## 🌟 Hackathon Highlight: Bounded Evidence Mission Agent

StreamSignal features an autonomous, bounded **Evidence Mission Agent** located in [`backend/app/agent/`](backend/app/agent/README.md).

Unlike generic chatbot demos or blind LLM wrappers that hallucinate water toxicity, the StreamSignal agent:
- 🔒 **Bounded State Machine ($S_0 \to S_7$)**: Mathematically enforces states from evidence gap discovery to research hand-off.
- 🛡️ **Tool Execution Firewall (`ALLOWED_AGENT_TOOLS`)**: Restricts agent capabilities strictly to allowlisted domain operations; treats user input as untrusted observation data.
- 🧬 **StreamSignal One Health Evidence Model ($E_1$ to $E_5$)**: Enforces ontological separation between Citizen Evidence ($E_1, E_2$), Machine Assistance ($E_3$), Corroboration ($E_4$), and Human Confirmation ($E_5$). **$E_4 \ne E_5$ is structurally enforced.**
- 💻 **Local-First & Zero-Cost**: Integrates with local **Ollama** via JSON Schema-constrained generation with an authoritative **Deterministic Rule Provider** fallback. Operates 100% offline with zero API costs.
- 📜 **FHIR R4 Gateway**: Connects directly to FHIR R4 `Observation`, `Media`, `Task`, and `Provenance` resources.

👉 **[Read the complete Evidence Mission Agent Architecture Guide](backend/app/agent/README.md)**

---

## 🏛️ System Architecture

```
+-----------------------------------------------------------------------------------+
|                                  StreamSignal                                     |
+-----------------------------------------------------------------------------------+
|  Citizen Contributor Loop & Bounded Mission Agent (backend/app/agent/)            |
|    - After-Rain Stream Checks, Evidence Clarification Missions, Site Snapshots   |
|    - Local Ollama JSON Schema Reasoning + Deterministic Rule Provider             |
|    - Immutable Agent Action Audit Log in PostgreSQL                               |
+-----------------------------------------+-----------------------------------------+
                                          | (Structured Evidence Submission)
                                          v
+-----------------------------------------------------------------------------------+
|  FastAPI Backend Core (backend/app/)                                              |
|    - Citizen Report & Media Processing (EXIF validation, hash deduplication)      |
|    - SignalCase Domain Model with Evidence Quality Scoring                        |
|    - SignalGuard: Scientific Guardrails enforcing E1-E5 evidence boundaries       |
|    - Pattern Echo: PostGIS spatial clustering + pgvector visual similarity        |
|    - Human Researcher Review Workspace                                            |
|    - Evidence Passport & FHIR R4 Provenance Gateway                               |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|  PostgreSQL 17 + PostGIS 3.5 + pgvector Container (Port 5433 / 5432)              |
|    - contributors, missions, agent_action_audits                                  |
|    - reports, report_media, signal_cases, case_audit_log                          |
+-----------------------------------------------------------------------------------+
```

---

## 🚀 Quickstart & Local Setup

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 2. Start the Docker Infrastructure
Launch the backend and database containers:
```bash
docker compose up -d
```

### 3. Verify Health & Extensions
Check running containers:
```bash
docker compose ps
```

Verify service and database extension endpoints:
- **FastAPI Documentation (Swagger UI)**: `http://localhost:8000/docs`
- **Backend Healthcheck**: `http://localhost:8000/health`
- **PostGIS & pgvector Extension Verification**: `http://localhost:8000/health/extensions/verify`

### 4. Run Automated Test Suite
Run pytest inside the backend container or locally:
```bash
pytest backend/tests/ -v
```

---

## 📚 Key Architectural Documentation

- 🤖 **[Evidence Mission Agent Architecture Guide](backend/app/agent/README.md)** — Complete deep-dive into state machines, firewalls, and local LLM execution.
- 📋 **[Agent Operating Contract (AGENTS.md)](AGENTS.md)** — Core non-hallucination rules, One Health principles, and engineering protocols.
- 🛡️ **[SignalGuard Rules (RULES.md)](RULES.md)** — Scientific trust boundaries preventing unwarranted environmental and medical claims.
