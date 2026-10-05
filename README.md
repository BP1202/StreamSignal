# 🌊 StreamSignal
### *From streams to systems: turning citizen science into actionable One Health intelligence.*

> Built for the **IEEE OneAquaHealth Global Hackathon 2026**  
> Aligned with the EU-funded **[OneAquaHealth Project](https://www.oneaquahealth.eu/)** connecting freshwater ecosystem health and human well-being.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2019%20+%20Vite-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20+%20PostGIS-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![FHIR R4](https://img.shields.io/badge/Standard-HL7%20FHIR%20R4-E05A47?style=flat-square)](https://hl7.org/fhir/R4/)
[![Tests](https://img.shields.io/badge/Tests-264%20Backend%20|%2093%20Frontend%20Passing-brightgreen?style=flat-square)]()

---

## 🚩 The Problem
Urban freshwater ecosystems face severe stress from runoff, sewage, and industrial discharges. While community members frequently spot stream anomalies (discoloration, foam, odor, wildlife mortality):
- **Complex apps & technical jargon** intimidate citizens, leading to low reporting rates.
- **Unverified AI detectors** produce noisy, unreliable "hallucinated" claims without scientific rigor.
- **Data fragmentation**: Citizen reports remain isolated in siloed apps, never reaching public health or environmental monitoring systems in standardized clinical/ecological formats.

---

## 💡 Our Solution
**StreamSignal** is a transparent, provenance-grounded One Health evidence platform. It turns casual citizen observations into reviewable, standards-compliant evidence without ever replacing human scientific judgment:

1. **Intuitive Citizen Flow**: Rapid, non-intrusive reporting with anonymous handles (`aqua-001`), guided visual signals, and clarifying mini-interviews.
2. **Explainable AI Assistance**: Automated photo quality checks and spatial-temporal clustering that *assist* researchers rather than making black-box diagnoses.
3. **Researcher Review & Audit Trail**: Limnologists review cases with mandatory rationales and verified reviewer IDs (`X-Reviewer-Id`).
4. **HL7 FHIR R4 Interoperability**: Deterministically exports cases into standard FHIR R4 Bundles (`Observation`, `Media`, `Location`, `Provenance`) ready for health and environmental authorities.

---

## 🎯 Hackathon Tracks Addressed

| Track | Challenge Addressed in StreamSignal |
|---|---|
| **Track 1: Citizen Science UX** | Intuitive mobile-ready flow, zero-password instant handles (`aqua-001`), interactive follow-up questions, and personal impact tracking. |
| **Track 3: AI-Supported Assessment** | Human-in-the-loop AI assistance: visual cue analysis with explicit uncertainty bounds; AI is strictly barred from confirming medical or toxic claims ($E_4 \ne E_5$). |
| **Track 7: Digital Health Standards** | Full HL7 FHIR R4 export gateway and cryptographic Evidence Passports for seamless interoperability across digital health and ecological systems. |

---

## ⚡ Quickstart (Run Demo in 3 Steps)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- [Node.js 18+](https://nodejs.org/)

```bash
# 1. Clone & Configure
git clone https://github.com/BP1202/StreamSignal.git
cd StreamSignal
cp .env.example .env

# 2. Start Backend & Database (Docker)
docker compose up -d --build

# 3. Start Frontend (React + Vite)
cd frontend
npm install
npm run dev
```

👉 Open **[http://localhost:5173](http://localhost:5173)** in your browser.  
*(Backend API & Swagger Docs available at [http://localhost:8000/docs](http://localhost:8000/docs))*

---

## 🎮 How to Test the Demo

```
┌────────────────────────────────┐       ┌────────────────────────────────┐
│      1. Citizen Reporting      │       │     2. Researcher Review       │
│                                │       │                                │
│ • Click "Continue as guest"    │  ───> │ • Switch to "Research" tab     │
│ • Upload stream photo          │       │ • Inspect photo & quality cues │
│ • Pick signals (e.g. Foam)     │       │ • Record verified decision     │
│ • Submit & answer 2 questions  │       │ • View live FHIR R4 Bundle     │
└────────────────────────────────┘       └────────────────────────────────┘
```

1. **Citizen Experience**:
   - Go to [http://localhost:5173](http://localhost:5173).
   - Click **"Continue without password (guest aqua-xxx)"** to enter with a private citizen handle.
   - Click **"Report Observation"**, upload a photo, select observed signals, click location, and submit.
   - Complete the short clarifying interview to see your transparent **Evidence Case**.
2. **Researcher Experience**:
   - Click **"Research"** in the top navigation bar.
   - Select the newly submitted case from the **Evidence Inbox**.
   - Review the raw citizen photos, quality scores, and contextual weather data.
   - Select an outcome (e.g. *"Request field verification"*), enter a rationale, and click **Record Decision**.
   - Scroll to **One Health Interoperability** to view the live **FHIR R4 Bundle JSON**.

---

## 🏛️ System Architecture

```text
Citizen Observation (Photos, GPS, Signals)
             │
             ▼
     FastAPI Backend  ───>  PostgreSQL + PostGIS (Spatial Indexing)
             │
             ├── Deterministic Quality & Visual Cue Heuristics
             ├── Real-time WebSocket Broadcast
             ▼
Researcher Review Portal (Human-in-the-Loop Audit)
             │
             ▼
HL7 FHIR R4 Bundle & Cryptographic Evidence Passport
```

---

## 🧪 Automated Tests

```bash
# Backend pytest suite (264 tests passing)
docker compose exec backend pytest

# Frontend vitest suite (93 tests passing)
cd frontend && npm test -- --run
```

---

## 🔒 One Health Privacy & Ethics
- **Non-identifying Citizen Handles**: Contributor identities use pseudonyms (`aqua-001`), protecting citizen privacy while preserving evidence attribution.
- **Safe Media Storage**: Magic-byte verification prevents malicious uploads; local storage paths are never leaked.
- **Scientific Integrity**: AI suggests and surfaces information, but only accredited human reviewers make definitive case determinations.

---

## 📄 License
MIT License — see [LICENSE](LICENSE) for details.
