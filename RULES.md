# StreamSignal — Engineering Rules

These rules complement `AGENTS.md`.
`AGENTS.md` defines agent behavior; this file defines core project engineering rules.

## 1. Core Rule

Build only what is required for the current task.

**One prompt = one task/issue.**

Do not silently expand scope.

---

## 2. Before Editing

Always:

1. Inspect the relevant existing code.
2. Understand dependencies.
3. Create an implementation plan.
4. Ask before proceeding if requirements are materially unclear.

**Never guess.**

---

## 3. Code Quality

Prefer:

* simple architecture
* small focused modules
* typed interfaces
* explicit validation
* reusable services
* testable business logic

Avoid unnecessary abstractions, dependencies, microservices, and infrastructure.

---

## 4. Backend

Use:

* FastAPI
* Pydantic
* SQLAlchemy
* PostgreSQL
* PostGIS
* pgvector
* Alembic
* pytest

API routes belong under:

```text
/api/v1/
```

Do not put significant business logic directly inside route handlers.

---

## 5. Database

All schema changes require an Alembic migration.

Never casually:

```text
DROP DATABASE
DROP TABLE
TRUNCATE
```

Never modify production schema manually.

Protect existing data.

---

## 6. Testing

For meaningful behavior:

```text
Test → Implement → Test → Verify
```

Never:

* delete tests to make them pass
* weaken assertions without justification
* claim tests passed without running them

A task is not complete while relevant tests are failing.

---

## 7. Security

Treat all external input as untrusted.

Never commit:

* passwords
* API keys
* tokens
* private keys
* `.env`

Validate:

* request data
* uploaded files
* file size/type/signature
* coordinates
* user permissions

Never expose secrets or internal errors through APIs.

---

## 8. AI / Science

AI output is **assistance, not truth**.

Always distinguish:

```text
Citizen observation
AI inference
Retrieved context
Rule-based result
Expert decision
```

Never claim environmental causation, toxicity, disease, or scientific confirmation without appropriate evidence and human validation.

**Similarity ≠ causation.**

---

## 9. Provenance

Never overwrite original citizen evidence with AI-generated information.

Important derived information should preserve:

* source
* timestamp
* operation
* actor/system

---

## 10. FHIR

FHIR must be generated through deterministic application logic.

Do not rely on an LLM to freely invent FHIR structures.

FHIR output must be:

* valid
* traceable
* provenance-aware
* based on actual application data

---

## 11. Dependencies

Before adding a package or service, ask:

> Do we actually need this?

Prefer existing project dependencies and standard library capabilities when sufficient.

---

## 12. Git

Before work:

```powershell
git status
git branch --show-current
```

Before commit:

```powershell
git diff
git diff --check
git status
```

Use focused commits:

```text
feat(scope): description
fix(scope): description
test(scope): description
chore(scope): description
docs(scope): description
```

Never force-push or rewrite history without explicit approval.

---

## 13. Verification

Never claim:

```text
Implemented
Passed
Working
Migrated
Deployed
```

unless it was actually verified.

Use:

```text
Verified
```

or:

```text
Not verified
```

---

## 14. Destructive Operations

Stop and ask before operations that may:

* delete data
* destroy files
* rewrite Git history
* affect production
* expose credentials
* change major architecture

---

## 15. Final Standard

Every completed feature should be:

**Correct → Tested → Secure → Understandable → Demonstrable**

When uncertain:

**ASK.**

Before editing:

**PLAN.**

After editing:

**VERIFY.**
