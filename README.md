# 🌊 StreamSignal

> **Urban Freshwater Surveillance & One Health Evidence Platform**  
> *Transforming citizen freshwater observations into transparent, reviewable, standards-compliant One Health evidence cases.*

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2019%20+%20Vite-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20+%20PostGIS-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![FHIR R4](https://img.shields.io/badge/Standard-HL7%20FHIR%20R4-E05A47?style=flat-square)](https://hl7.org/fhir/R4/)
[![Tests](https://img.shields.io/badge/Tests-264%20Backend%20|%2093%20Frontend%20Passing-brightgreen?style=flat-square)]()

---

## 📌 What is StreamSignal?

StreamSignal bridges the gap between everyday community freshwater sightings and professional watershed surveillance. 

Instead of acting as a black-box image classifier or making unverified environmental claims, StreamSignal functions as an **auditable evidence platform**. It maintains strict epistemic separation between:
1. **Citizen Evidence**: Raw observational text, timestamps, GPS coordinates, and media uploads.
2. **Machine Assistance**: Automated photo quality assessments, visual cues, and spatial-temporal clustering.
3. **Contextual Corroboration**: Weather history, rain events, and watershed coverage gaps.
4. **Human Expert Decision**: Verified determinations by authorized researchers with immutable provenance.

---

## 🚀 Quickstart (Run Demo Locally)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- [Node.js 18+](https://nodejs.org/) (for frontend)

---

### Step 1: Clone & Configure
```bash
git clone https://github.com/BP1202/StreamSignal.git
cd StreamSignal

# Create environment configuration from template
cp .env.example .env
```

---

### Step 2: Start Backend & Database
Launch the PostgreSQL database (with PostGIS) and FastAPI backend containers:
```bash
docker compose up -d --build
```
*Verification:*
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Health Check**: [http://localhost:8000/health](http://localhost:8000/health)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Step 3: Start Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🎮 How to Test the Demo

### 1. Citizen Contributor Journey
1. Open [http://localhost:5173](http://localhost:5173).
2. On the sign-in modal, click **"Continue without password (guest aqua-xxx)"** to receive an instant anonymous citizen handle (e.g. `aqua-001`).
3. Click **"Report Observation"** or **"Start with photo"**.
4. Upload an urban stream photograph (JPG/PNG).
5. Select observed signals (e.g., surface discoloration, foam, odor) and enter a description.
6. Provide GPS coordinates (or use the one-click *"Use current location"* button) and click **Submit**.
7. Complete the brief 2-question clarification interview to generate your structured **SignalCase**.

---

### 2. Researcher & Limnologist Review
1. Switch to the **Researcher Workspace** using the top navigation bar or sign in as Researcher.
2. Open the **Evidence Inbox** to see incoming unreviewed citizen observations sorted by triage urgency.
3. Select your submitted case to open the **SignalCase Investigation View**:
   - Inspect raw citizen evidence and high-resolution media.
   - Review automated quality metrics and contextual weather corroboration.
4. In the **Researcher Review Panel**, select an action (e.g., *Request field verification*, *Mark related case*), enter your empirical rationale, verify your **Reviewer ID** (`X-Reviewer-Id`), and click **Record Decision**.
5. Scroll down to **One Health Interoperability** to view or download the generated **HL7 FHIR R4 Bundle** and cryptographic **Evidence Passport**.

---

## 🏛️ System Architecture & Data Flow

```text
[ Citizen Smartphone / Web App ]
               │
               ▼  (POST /api/v1/reports + Media Upload)
     [ FastAPI Backend ] 
               ├── File signature & EXIF verification
               ├── PostGIS geospatial indexing
               └── Deterministic triage scoring
               │
               ▼
      [ PostgreSQL + PostGIS ]
               │
               ▼
[ Researcher Review Portal ]
               ├── Inspect citizen evidence & cues
               ├── Record auditable decision (X-Reviewer-Id)
               └── Append immutable EvidenceLineageEvent
               │
               ▼
   [ HL7 FHIR R4 / Evidence Passport ]
  (Ready for Public Health & Environmental Agencies)
```

---

## 🛠️ Technology Stack

| Component | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 |
| **Database** | PostgreSQL 16 with PostGIS & pgvector |
| **Interoperability** | HL7 FHIR R4 (`Observation`, `Media`, `Location`, `Provenance`) |
| **Auth & Audit** | RBAC, OIDC / Auth0 support, explicit `X-Reviewer-Id` audit provenance |
| **Containerization** | Docker, Docker Compose |

---

## 🧪 Running Tests

### Backend Test Suite (264 Tests)
```bash
docker compose exec backend pytest
```

### Frontend Test Suite (93 Tests)
```bash
cd frontend
npm test -- --run
```

### Frontend Production Build
```bash
cd frontend
npm run build
```

---

## 🔒 Security & Privacy Commitments

- **Decoupled Citizen Identity**: Community members are identified through non-identifying pseudonyms (`aqua-001`, `SS-C-1001`), protecting privacy while preserving evidence attribution.
- **Strict Media Validation**: All uploads are verified by magic byte file signatures and MIME validation. Server disk paths are strictly redacted.
- **Mandatory Audit Headers**: Review operations strictly enforce `X-Reviewer-Id` to prevent unattributed scientific determinations.
- **Zero Hallucinated Claims**: AI agents and automated heuristics cannot alter human review outcomes or declare water toxicity without verified human confirmation.

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
