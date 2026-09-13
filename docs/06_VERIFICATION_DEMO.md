# Verification, Demo & Submission

This is an acceptance checklist, not proof that tests have passed.

## Release checks

- Backend tests pass
- Frontend tests pass
- Build succeeds
- Production environment works
- Real LLM integration is tested
- No secrets in repository
- README reflects actual implementation

## P0 acceptance matrix

| ID | Check | Owner |
|---|---|---|
| DATA-01 | Valid CSV/XLSX uploads and receives dataset_id | D1/D2 |
| DATA-02 | Invalid/empty/malformed files are rejected | D1 |
| DATA-03 | Profile correctly reports schema and data quality | D1 |
| SQL-01 | Normal business question produces safe analytical SQL | D2 |
| SQL-02 | Destructive/arbitrary SQL is rejected | D2 |
| AI-01 | Real LLM request returns validated agent plan | D2 |
| AI-02 | Invalid tool arguments are rejected/repaired within bound | D2 |
| ANA-01 | KPI result matches fixture expectation | D1 |
| ANA-02 | Trend analysis matches fixture expectation | D1 |
| ANA-03 | Anomaly detector flags known synthetic outliers | D1 |
| FLOW-01 | Question → tool → result works end to end | D1/D2 |
| FLOW-02 | Result is converted into a chart | D3 |
| FLOW-03 | Result generates an executive report | D2/D3 |
| UI-01 | Loading/error/empty/success states work | D3 |
| SEC-01 | Dataset isolation and authorization work | D2 |
| SEC-02 | Prompt injection cannot grant arbitrary tool access | D2 |
| REL-01 | Fresh build/deployment succeeds | D2/D3 |
| REL-02 | README and demo contain no secrets or fake results | All |

## Controlled demo dataset

Use a synthetic business dataset containing fields such as:

- order_id
- order_date
- region
- product
- customer_segment
- units
- revenue
- cost
- profit

Add a small number of intentionally unusual rows for anomaly detection.

Do not use private company/customer information.

## Three-minute demo

### 0:00–0:20 — Problem
“Business data is available, but turning it into reliable insights often requires manual SQL, analysis and reporting. This platform lets a user move from raw data to explainable business intelligence through one controlled AI workflow.”

### 0:20–0:45 — Upload
Upload the synthetic dataset and show automatic profiling.

### 0:45–1:20 — Ask a question
Ask a real question such as:
“Which region had the strongest revenue growth?”

Show the agent selecting an appropriate tool and the computed result.

### 1:20–1:50 — Visualization
Show the generated chart and explain the actual numbers.

### 1:50–2:20 — Anomaly/trend
Run anomaly detection or trend analysis and show the supporting records/metrics.

### 2:20–2:45 — Executive report
Generate the report with KPIs, findings and charts.

### 2:45–3:00 — Architecture
Explain:
- frontend
- FastAPI
- agent
- safe tools
- analytics engine
- validation
- reporting

Never present fixture output as a live AI result. Clearly label demo acceleration or precomputed fallback if used.
