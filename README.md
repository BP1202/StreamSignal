# 🌊 StreamSignal — One Health Evidence System
> *Urban Freshwater Observation, Evidence Interoperability & One Health Surveillance*

StreamSignal turns uncertain citizen freshwater observations into transparent, reviewable, provenance-rich, standards-ready **One Health evidence cases**.

The platform is designed around a fundamental principle: **StreamSignal is an evidence system, not a black-box detector.** It never diagnoses disease, declares water "toxic", or asserts environmental causation from unverified inputs. Instead, it maintains strict ontological separation between citizen observations, automated machine cues, contextual corroboration, and authorized human expert decisions.

---

## 🧭 Core Architectural Principles

### 1. The StreamSignal One Health Evidence Model ($E_1$ to $E_5$)

Evidence states are strictly partitioned and tamper-resistant:

| Tier | Name | Meaning | Authority |
|---|---|---|---|
| **$E_1$** | **REPORTED** | Citizen-submitted observation text and structured attributes. | Citizen contributor |
| **$E_2$** | **DOCUMENTED** | Verified photographic media with cryptographic SHA-256 integrity hashes and EXIF metadata. | Upload pipeline |
| **$E_3$** | **INFERRED** | Automated machine vision visual cues (discoloration, foam patterns) with explicit uncertainty bounds. | Machine analysis |
| **$E_4$** | **CORROBORATED**| Spatio-temporal clustering (PostGIS) and visual embedding similarity (pgvector). | Pattern Echo engine |
| **$E_5$** | **VERIFIED** | Authorized human decision (e.g. professional field verification, environmental agency review). | **Human reviewer ONLY** |

> **$E_4 \ne E_5$ Boundary:** High contextual similarity ($E_4$) is never conflated with verified truth ($E_5$). AI models, automated agents, computer vision, and citizen contributors are mathematically barred from emitting or upgrading to $E_5$. Only an authenticated human reviewer using the research workflow can establish $E_5$.

---

## 🏛️ System Architecture

```
                                  CITIZEN LOOP
                                       │
                      [ Citizen Observation & Media Upload ]
                                       │ (E1 / E2)
                                       ▼
                       [ SignalCase Domain Model & Quality ]
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
             [ Machine Vision (E3) ]           [ Pattern Echo (E4) ]
             (Visual Cue Extraction)           (PostGIS + pgvector)
                      │                                 │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                          [ SignalGuard Trust Contract ]
                         (Enforces Evidence Boundaries)
                                       │
                                       ▼
                         [ Human Review & Oversight ]  <─── RESEARCHER
                                       │ (E5)
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
         [ One Health Evidence Passport ]      [ FHIR R4 Provenance Gateway ]
         (Cryptographic Audit Lineage)         (Interoperable Resources)
```

### Research-Driven Evidence Gap Loop

In addition to citizen-initiated reports, StreamSignal supports a researcher-driven evidence loop:

```
Real PostgreSQL SignalCases
         │
         ▼
[ Evidence Gap Intelligence ]  (Factual availability ratios, zero synthetic data)
         │
         ▼
[ Researcher Authors Need ]    (Mandatory substantive rationale; placeholders blocked)
         │
         ▼
[ Researcher FSM Approval ]    (IDENTIFIED → REVIEWED → APPROVED)
         │
         ▼  (AGENT GATE: Only APPROVED needs are visible)
[ Evidence Mission Agent ]     (Autonomous bounded orchestrator, S0 → S7)
         │
         ▼
[ Targeted Citizen Mission ]   (After-Rain checks, Clarifications, Snapshots)
```

---

## 🤖 Bounded Evidence Mission Agent

Located in [`backend/app/agent/`](backend/app/agent/README.md), the **Evidence Mission Agent** turns researcher-approved evidence needs into guided citizen missions:

- 🔒 **Finite State Machine ($S_0 \to S_7$)**: Transition firewall prevents illegal state jumps or premature submission of incomplete evidence.
- 🛡️ **Tool Execution Firewall (`ALLOWED_AGENT_TOOLS`)**: Restricts capabilities to 7 allowlisted tools; treats citizen input as untrusted data.
- 🔬 **Researcher Authority Gate**: The agent can only read `APPROVED` MissionNeeds. It has zero authority to create, approve, or close research needs.
- 💻 **Local-First & Zero-Cost**: Powered by local **Ollama** (`llama3.2`) with JSON Schema-constrained structured outputs and an authoritative **Deterministic Rule Provider** fallback. Operates 100% offline with zero commercial API dependencies.
- 📜 **Provenance Preservation**: Links planned missions to the originating `mission_need_id` and records every step in PostgreSQL `agent_action_audits`.

👉 **[Read the complete Evidence Mission Agent Architecture Guide](backend/app/agent/README.md)**

---

## 🌐 Standards-Based Interoperability (FHIR R4)

StreamSignal serializes verified evidence into FHIR R4 resources ready for cross-sector One Health data exchange:

- **`Location`**: Geographic coordinates and spatial context.
- **`QuestionnaireResponse`**: Structured citizen observation questions and responses.
- **`Observation`**: Tier-separated observations isolating citizen reports ($E_1$), machine cues ($E_3$), and contextual echoes ($E_4$).
- **`Media`**: Cryptographic SHA-256 hashes, MIME types, and dimensions (server disk paths are strictly redacted).
- **`Task`**: Workflow tasks tracking human review status (`requested`, `in-progress`, `completed`).
- **`Provenance`**: Authoritative audit trail recording agents, activities, and cryptographic signatures.

---

## 🚀 Quickstart & Local Development

### Prerequisites
- Docker & Docker Compose
- Python 3.11+ (for local backend development)
- Node.js 18+ (for frontend development)

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 2. Start Infrastructure
Launch the PostgreSQL (with PostGIS and pgvector) and backend containers:
```bash
docker compose up -d
```

### 3. Verify Health & Extensions
- **FastAPI Documentation (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Backend Healthcheck**: [http://localhost:8000/health](http://localhost:8000/health)
- **Database Extension Verification**: [http://localhost:8000/health/extensions/verify](http://localhost:8000/health/extensions/verify)

### 4. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
Access the application at [http://localhost:5173](http://localhost:5173).

---

## 🧪 Automated Testing

### Backend Test Suite (pytest)
```bash
pytest backend/tests/ -v
```
Runs 208 comprehensive automated tests covering:
- Citizen report submission & coordinate validation
- EXIF inspection & media security
- Deterministic triage engine & SignalGuard interpretation firewall
- PostGIS spatial clustering & pgvector visual similarity
- Human review workflow & immutable evidence lineage
- FHIR R4 export & external consumer bundle validation
- Evidence Mission Agent FSM, tool firewall, and 10-point adversarial security audit
- Evidence Gap Intelligence & Mission Need lifecycle FSM

### Frontend Test Suite (Vitest)
```bash
cd frontend
npm test -- --run
```
Runs 42 component and integration tests covering:
- Citizen guided observation journey
- SignalCase investigation view & Why-This-Case rationales
- Live Evidence Bridge WebSocket updates
- Contributor identity & mission execution flow
- Evidence Gap Intelligence panel & Mission Needs tracker
- Evidence Passport & FHIR R4 provenance modal viewers

### Frontend Production Build
```bash
cd frontend
npm run build
```

---

## 🛡️ Security & Privacy Boundaries

1. **Untrusted Citizen Input**: All text, coordinates, timestamps, and media undergo strict length, type, signature (magic byte), and range validation.
2. **Path Traversal & Storage Isolation**: Uploaded files receive random UUID storage names; user-provided filenames and internal server paths are never exposed over APIs or in FHIR bundles.
3. **No Phantom / Synthetic Data**: An empty database returns empty results with zero phantom cases, simulated metrics, or placeholder summaries.
4. **Researcher Accountability**: All human review decisions require substantive rationales and authenticated reviewer identification.
5. **No Secret Leakage**: Stack traces, SQL queries, credentials, and environment secrets are excluded from API responses and log outputs.

---

## 📚 Key Architectural Documentation

- 🤖 **[Evidence Mission Agent Architecture Guide](backend/app/agent/README.md)** — Deep-dive into state machines, execution firewalls, and local LLM execution.
- 📋 **[Agent Operating Contract (AGENTS.md)](AGENTS.md)** — Core non-hallucination rules, One Health principles, and engineering protocols.
- 🛡️ **[SignalGuard Rules (RULES.md)](RULES.md)** — Scientific trust boundaries preventing unwarranted environmental and medical claims.
