# Autonomous Business Intelligence Agent — Technical Contracts

This is the shared source of truth. Shared contract changes require agreement from all three developers.

## 1. Suggested stack

- Python 3.12+
- FastAPI backend
- React + TypeScript frontend
- Tailwind CSS
- Pandas / NumPy
- Scikit-learn
- SQLAlchemy or DuckDB for analytical querying
- PostgreSQL for application metadata/history
- LLM through one server-side OpenAI-compatible adapter
- Recharts or equivalent charting library
- Docker for reproducible local setup
- Vercel/Render/Railway/AWS or another agreed deployment target

Pin versions once. Do not independently upgrade dependencies.

## 2. Secrets

Use environment variables:

```dotenv
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL=
DATABASE_URL=
APP_URL=
```

Never expose server credentials to the browser.

## 3. Repository ownership

```text
abi-agent/
  docs/
  backend/
    app/
      api/                 # D2
      agents/              # D2
      tools/               # D1 + D2 contracts
      analytics/           # D1
      ingestion/           # D1
      db/                  # D2
      models/              # D2
      schemas/             # shared; D2 coordinates
      services/            # feature owners
    tests/
  frontend/
    src/
      components/          # D3
      pages/               # D3
      features/            # D3
      api/                 # D3, D2 contract
      charts/              # D3
  data/
    fixtures/              # synthetic/demo data only
  reports/
  README.md
```

## 4. Shared data contract

Every uploaded dataset has:

- dataset_id
- filename
- file_type
- row_count
- column_count
- schema
- quality_summary
- created_at

A column description includes:

- name
- inferred type
- nullable
- unique_count
- sample values where safe

## 5. Agent request contract

```json
{
  "dataset_id": "uuid",
  "question": "string",
  "context": {}
}
```

Agent response:

```json
{
  "status": "success",
  "tool": "run_safe_sql",
  "reason": "short user-safe explanation",
  "result_id": "uuid",
  "chart_spec": {},
  "insights": [],
  "warnings": []
}
```

Do not store hidden chain-of-thought. Store concise decision summaries only.

## 6. Tool safety

- No arbitrary shell execution.
- No arbitrary Python from user text.
- No unrestricted SQL.
- SQL must be parsed/validated and limited to the selected dataset.
- Python analysis must use registered functions.
- File access must be restricted to the current dataset/workspace.
- Tool parameters must be schema validated.

## 7. Core analytical functions

Developer 1 provides typed functions for:

```text
profile_dataset(dataset)
calculate_kpis(dataset, metric_config)
run_safe_analysis(dataset, analysis_config)
detect_trends(dataset, time_column, metric)
detect_anomalies(dataset, feature_columns)
summarize_grouped_metrics(dataset, dimensions, metrics)
```

Exact signatures are agreed before parallel implementation.

## 8. API boundary

D2 owns API implementation. D3 consumes documented request/response shapes.

Examples:

```text
POST /api/datasets/upload
GET  /api/datasets/{id}/profile
POST /api/analysis/query
GET  /api/analysis/{id}
POST /api/reports/generate
GET  /api/reports/{id}
```

API handlers should remain thin and delegate to services.

## 9. Frontend states

Every major screen must handle:

- loading
- empty
- success
- validation error
- server error
- unauthorized/expired state

Never display an insight before the backend confirms the computation succeeded.
