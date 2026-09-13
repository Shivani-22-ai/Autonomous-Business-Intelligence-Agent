# 09_DEPLOYMENT.md

# Autonomous Business Intelligence Agent — Deployment Plan

## 1. Purpose

This document defines the production deployment process for the Autonomous Business Intelligence Agent.

The system must be deployed as one integrated application consisting of:

```text
Frontend
   ↓
Backend API
   ↓
AI Agent
   ↓
Analytics / ML Tools
   ↓
Database
   ↓
LLM Provider
```

Deployment is owned primarily by Developer 2 (Integration Lead), with Developers 1 and 3 responsible for validating their respective components in production.

---

## 2. Deployment Ownership

### Developer 1 — Data + ML

Responsible for:

- Production-safe data ingestion
- Profiling and analytics functions
- KPI calculations
- Trend detection
- Anomaly detection
- ML dependency compatibility
- Verification that production outputs match development outputs
- Providing any required production configuration to the Integration Lead

### Developer 2 — AI Agent + Backend + Integration Lead

Primary owner of:

- Final repository
- Backend deployment
- Database deployment/configuration
- LLM provider configuration
- Environment variables
- CORS configuration
- API security
- Docker configuration
- CI/CD configuration if implemented
- Final integration testing
- Production deployment
- Rollback procedure

### Developer 3 — Frontend + Visualization + Reporting

Responsible for:

- Production frontend build
- API URL configuration
- Frontend environment variables
- CORS/API integration verification
- Chart/report rendering verification
- Production UI testing

---

## 3. Recommended Production Architecture

Use a simple architecture that is easy to explain in interviews:

```text
                         ┌─────────────────┐
                         │      USER       │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │    FRONTEND     │
                         │ React + TS      │
                         └────────┬────────┘
                                  │ HTTPS
                                  ▼
                         ┌─────────────────┐
                         │   BACKEND API   │
                         │    FastAPI      │
                         └───────┬─┬───────┘
                                 │ │
                    ┌────────────┘ └─────────────┐
                    ▼                            ▼
             ┌──────────────┐             ┌──────────────┐
             │  PostgreSQL  │             │  LLM Provider│
             │   Database   │             │  API         │
             └──────────────┘             └──────────────┘
                                 │
                                 ▼
                         ┌─────────────────┐
                         │ Analytics / ML  │
                         │ Pandas / sklearn│
                         └─────────────────┘
```

The exact hosting providers can be selected by the Integration Lead based on cost, reliability, and project requirements.

---

## 4. Environment Separation

Maintain at least:

```text
Development
Production
```

Do not use production credentials during local development.

Recommended environment files:

```text
.env.example
.env
```

`.env` must never be committed to Git.

Only `.env.example` should be committed.

---

## 5. Required Environment Variables

The project already defines these core variables:

```text
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL=
DATABASE_URL=
APP_URL=
```

Additional variables may be added if required by the selected hosting provider.

Example:

```text
LLM_API_KEY=<secret>
LLM_BASE_URL=<provider-base-url>
LLM_MODEL=<model-name>
DATABASE_URL=<production-database-url>
APP_URL=<production-frontend-url>
```

### Rules

- Never hard-code API keys.
- Never commit `.env`.
- Never place secrets in frontend source code.
- Never expose the LLM API key to the browser.
- Production secrets must be stored using the hosting provider's secret/environment-variable system.

---

## 6. Database Deployment

The production database must be separate from development data.

Before deployment:

1. Create the production PostgreSQL database.
2. Configure `DATABASE_URL`.
3. Run database migrations.
4. Verify required tables.
5. Verify database connectivity from the backend.
6. Confirm dataset isolation.
7. Test analysis history persistence.

Do not use real customer or confidential business data for demonstrations unless explicitly authorized.

Use synthetic/sample data for the project demo.

---

## 7. Backend Deployment

The backend should be deployed as a production FastAPI service.

Before deployment:

```text
Install dependencies
        ↓
Run type checks
        ↓
Run linting
        ↓
Run unit tests
        ↓
Run security tests
        ↓
Build application
        ↓
Start production server
```

The production backend must:

- Accept HTTPS traffic.
- Connect to the production database.
- Connect to the configured LLM provider.
- Enforce dataset isolation.
- Enforce safe SQL rules.
- Validate request payloads.
- Reject unauthorized/destructive operations.
- Apply reasonable upload/resource limits.
- Never expose secrets in API responses or logs.

---

## 8. Frontend Deployment

Build the React/TypeScript frontend using the production API URL.

Example configuration concept:

```text
Frontend
   ↓
Production API URL
   ↓
FastAPI Backend
```

The frontend must not contain:

```text
LLM_API_KEY
DATABASE_URL
database credentials
private backend secrets
```

After deployment, verify:

- Landing page loads.
- Dataset upload works.
- Dataset profile loads.
- Natural-language analysis works.
- KPI cards render.
- Charts render.
- Anomaly results render.
- Analysis history loads.
- Executive report loads.

---

## 9. CORS Configuration

The backend must allow requests from the actual production frontend domain.

Development:

```text
http://localhost:<frontend-port>
```

Production:

```text
https://<production-frontend-domain>
```

Do not use unrestricted CORS such as:

```text
*
```

for the final production configuration unless there is a deliberate and documented reason.

---

## 10. Docker

Docker may be used to make deployment reproducible.

Recommended structure:

```text
project/
├── backend/
│   └── Dockerfile
├── frontend/
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

For local integration testing, Docker Compose can provide:

```text
Frontend
Backend
PostgreSQL
```

The production hosting setup may use managed services instead of running everything through one Docker Compose server.

---

## 11. CI/CD

If CI/CD is implemented, every merge to `main` should run:

```text
Install dependencies
       ↓
Lint
       ↓
Typecheck
       ↓
Unit tests
       ↓
Security tests
       ↓
Build
       ↓
Deploy
```

Deployment should happen only after required checks pass.

At minimum, the team should manually run the complete verification suite before the first production deployment.

---

## 12. Production Safety Checklist

Before deployment, verify:

### Security

- [ ] No API keys committed
- [ ] `.env` ignored by Git
- [ ] LLM key exists only on backend
- [ ] SQL execution is restricted
- [ ] Destructive SQL is rejected
- [ ] Dataset IDs are validated
- [ ] User input is validated
- [ ] Upload size/type limits exist
- [ ] No arbitrary Python execution is exposed
- [ ] No shell/OS command execution is exposed
- [ ] Production CORS is restricted
- [ ] Secrets are not printed in logs

### Backend

- [ ] Database connection works
- [ ] LLM connection works
- [ ] API health endpoint works
- [ ] Dataset upload works
- [ ] Analysis endpoint works
- [ ] Report endpoint works
- [ ] Error handling works

### Data/ML

- [ ] CSV ingestion works
- [ ] XLSX ingestion works
- [ ] Profiling works
- [ ] KPI calculations verified
- [ ] Trend detection verified
- [ ] Anomaly detection verified
- [ ] Results are deterministic where expected

### Frontend

- [ ] Production build succeeds
- [ ] API URL is correct
- [ ] Upload UI works
- [ ] Dashboard works
- [ ] Charts work
- [ ] Insight cards work
- [ ] Report page works
- [ ] Loading states work
- [ ] Error states work
- [ ] Empty states work
- [ ] Mobile/basic responsive behavior checked

---

## 13. End-to-End Production Test

Run this complete flow after deployment:

```text
1. Open production frontend
        ↓
2. Upload synthetic business dataset
        ↓
3. Verify dataset profile
        ↓
4. Ask:
   "Which region generated the highest profit?"
        ↓
5. AI agent interprets the question
        ↓
6. Agent selects the appropriate tool
        ↓
7. Backend validates the operation
        ↓
8. SQL/analytics executes safely
        ↓
9. Numerical result is returned
        ↓
10. Frontend displays the insight
        ↓
11. Chart is generated
        ↓
12. Generate executive report
        ↓
13. Verify report contents
```

The team must verify that the displayed numbers actually come from the dataset and are not invented by the LLM.

---

## 14. Health Check

Provide a simple backend health endpoint such as:

```text
GET /health
```

Expected behavior:

```text
200 OK
```

The health check should confirm that the application process is running.

A deeper readiness check may verify:

```text
Backend
Database
Required configuration
```

Do not expose sensitive configuration values.

---

## 15. Logging

Production logs should help diagnose failures without exposing secrets.

Log useful information such as:

```text
Request received
Dataset ID
Analysis ID
Tool selected
Execution duration
Success/failure status
Error category
```

Do not log:

```text
API keys
Database passwords
Full private datasets
Sensitive user information
Authentication tokens
```

---

## 16. Monitoring

At minimum monitor:

- Backend availability
- API errors
- Request latency
- Database connectivity
- LLM failures
- Failed analysis jobs
- Upload failures
- Frontend/API connectivity

For a student project, a simple hosting-provider monitoring solution is sufficient.

---

## 17. Rollback Plan

If a production deployment breaks:

```text
Detect problem
      ↓
Stop further deployment
      ↓
Identify previous working version
      ↓
Rollback backend/frontend
      ↓
Verify health endpoint
      ↓
Run end-to-end smoke test
      ↓
Document issue
```

Never make emergency production changes without recording what was changed.

---

## 18. Final Release Process

The Integration Lead should perform the final release in this order:

```text
Developer 1 branch
       ↓
Review + tests
       ↓
Merge
       ↓
Developer 2 backend/agent
       ↓
Review + tests
       ↓
Merge
       ↓
Developer 3 frontend
       ↓
Review + build
       ↓
Merge
       ↓
Full integration testing
       ↓
Security testing
       ↓
Production configuration
       ↓
Deploy
       ↓
Production smoke test
       ↓
🚀 RELEASE
```

Do not merge all three branches blindly.

Resolve contract conflicts before merging.

---

## 19. Final Deployment Acceptance Criteria

The project is considered deployed only when all of the following are true:

- [ ] Production frontend is accessible.
- [ ] Production backend is accessible.
- [ ] Backend health check succeeds.
- [ ] Production database connection succeeds.
- [ ] LLM integration succeeds.
- [ ] Dataset upload succeeds.
- [ ] Dataset profiling succeeds.
- [ ] Natural-language question succeeds.
- [ ] Safe SQL/analytics execution succeeds.
- [ ] KPI calculation succeeds.
- [ ] Trend detection succeeds.
- [ ] Anomaly detection succeeds.
- [ ] Charts render correctly.
- [ ] Insight cards display correct results.
- [ ] Executive report generation succeeds.
- [ ] Analysis history works.
- [ ] Security tests pass.
- [ ] No secrets are exposed.
- [ ] README contains accurate setup/deployment instructions.
- [ ] Final 3-minute demo works from the deployed application.

---

## 20. Interview-Ready Deployment Explanation

Every developer should understand the deployment architecture well enough to explain it.

A strong explanation is:

> "We separated the frontend, backend, analytics/ML, database, and LLM responsibilities. The React frontend communicates with a FastAPI backend over HTTPS. The backend validates requests and controls access to bounded analytical tools. Numerical computation is performed by SQL/Pandas/ML code rather than being invented by the LLM. PostgreSQL stores application metadata and analysis history, while the LLM is used for interpretation and planning. Secrets remain server-side and production configuration is managed through environment variables."

The team should be able to explain:

- Why the LLM does not directly execute arbitrary code.
- How SQL injection is prevented.
- How datasets are isolated.
- Where the LLM API key is stored.
- How frontend and backend communicate.
- How the database is connected.
- How ML/analytics functions are exposed to the agent.
- How the application is tested before deployment.
- How the system can be rolled back.

---

## 21. Deployment Ownership Summary

```text
Developer 1
    │
    └── Data + ML production verification

Developer 2
    │
    ├── Backend deployment
    ├── Database
    ├── LLM configuration
    ├── Integration
    ├── Security
    └── FINAL DEPLOYMENT OWNER

Developer 3
    │
    └── Frontend production verification
```

The Integration Lead owns the final production release, but all three developers must verify their own components after deployment.
