# Autonomous Business Intelligence Agent — Master Implementation Plan

## 1. Goal

Build an end-to-end Business Intelligence platform that turns uploaded business data into explainable, actionable analysis.

### Core flow

Upload dataset
→ schema/data profiling
→ natural-language business question
→ AI agent chooses a bounded tool
→ SQL/Python analysis
→ validation
→ trends/anomalies/KPIs
→ interactive charts
→ executive summary/report

The product should demonstrate real AI-assisted analytics rather than being a simple chatbot wrapped around an API.

## 2. P0 — Core features

- CSV/XLSX upload and validation
- Automatic schema and data-quality profiling
- Natural-language question interface
- AI agent with bounded tool selection
- Safe text-to-SQL for supported relational data
- Python/Pandas analytical tools
- KPI and descriptive-statistics analysis
- Trend detection
- Anomaly detection
- Interactive visualizations
- Explainable insight cards
- Executive report generation
- Persistent analysis history
- Error handling and validation
- Tests, README and deployed demo

## 3. P1 — Add after P0 works

- Multiple datasets in one workspace
- Dataset comparison
- Forecasting
- Customer/product segmentation
- What-if analysis
- Scheduled report generation
- Export to PDF
- More advanced chart recommendations

## 4. P2 — Polish

- Advanced agent memory
- Rich animations
- Voice interface
- Multi-user workspaces
- Custom enterprise connectors

Do not build P1/P2 before the core vertical slice works.

## 5. User journey

1. User uploads a business dataset.
2. System validates file type, size and structure.
3. Data profiler reports rows, columns, types, missing values and basic statistics.
4. User asks a question such as “Which region had the highest revenue growth?”
5. Agent interprets the question and chooses an allowed analysis tool.
6. SQL/Python executes only against the uploaded dataset.
7. Result is validated before being shown.
8. System generates a suitable visualization.
9. Agent explains the result using the actual computed values.
10. User can generate an executive report containing KPIs, findings, charts and recommended actions.

## 6. Three-developer architecture

### Developer 1
Data ingestion, profiling, analytical engine, anomaly detection and ML utilities.

### Developer 2
LLM provider adapter, agent orchestration, text-to-SQL, tool permissions, FastAPI/API layer and persistence.

### Developer 3
React interface, dashboard, charts, report UI/export, responsive states and integration QA.

## 7. Agent design

The agent is not allowed to execute arbitrary code.

Allowed tools should be explicit, for example:

- profile_dataset
- run_safe_sql
- run_python_analysis
- detect_anomalies
- calculate_kpis
- detect_trends
- create_chart_spec
- generate_report

Each tool has a typed input/output contract.

The agent decides which tool to call; the backend validates the requested tool and parameters.

## 8. Analytics expectations

The project should support business questions involving:

- revenue
- profit
- orders
- customers
- products
- regions
- dates
- growth
- averages
- rankings
- outliers

The dataset profiler must identify available columns instead of assuming a fixed schema.

## 9. Interview-readiness requirement

Every developer must be able to explain:

- complete system architecture
- their own module
- data flow
- why the chosen ML/AI approach was used
- limitations
- security boundaries
- one failure case
- one design trade-off

AI-generated code must be reviewed and understood before it is presented.

## 10. Scope rule

If time is short, cut advanced features and visual polish first. Never cut dataset validation, safe tool execution, real AI integration, analytics correctness, testing or honest reporting.
