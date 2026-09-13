# Autonomous Business Intelligence (ABI) Agent

An enterprise-grade Autonomous Business Intelligence platform that transforms uploaded business data into explainable, mathematically verified, and actionable analytics through a bounded AI agent workflow.

![Build & Test](https://img.shields.io/badge/backend%20tests-69%2F69%20passed-emerald)
![Frontend Tests](https://img.shields.io/badge/frontend%20tests-39%2F39%20passed-emerald)
![Python](https://img.shields.io/badge/python-3.11%2B%20%7C%203.14-blue)
![React](https://img.shields.io/badge/react-19-cyan)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-teal)
![Streamlit](https://img.shields.io/badge/Streamlit-1.30%2B-red)

---

## 1. System Architecture

```text
                                  ┌───────────────────────────┐
                                  │      User / Browser       │
                                  └─────────────┬─────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
        ┌─────────────────────────┐                           ┌─────────────────────────┐
        │  React + Vite Frontend  │                           │  Streamlit Application  │
        │    (SPA Dashboard)      │                           │      (Standalone)       │
        └────────────┬────────────┘                           └────────────┬────────────┘
                     │ REST API / HTTPS                                    │
                     ▼                                                     │
        ┌─────────────────────────────────────────────────────┐            │
        │             FastAPI Backend Services                │            │
        │  • Dataset Ingestion & Profiling                    │            │
        │  • Agent Planner & Tool Router                      │◄───────────┘
        │  • Safe SQL AST Parser & Execution Sandbox          │
        │  • History & Executive Reporting Engine             │
        └────────────┬─────────────────────────┬──────────────┘
                     │                         │
                     ▼                         ▼
        ┌─────────────────────────┐ ┌─────────────────────────┐
        │   Deterministic Tools   │ │   Server-side LLM       │
        │  • Pandas KPI Engine    │ │   Provider Adapter      │
        │  • Scikit-learn Anomaly │ │  • Tool Selection       │
        │  • Resampled Trend ML   │ │  • Text-to-SQL Plan     │
        │  • Grouped Aggregations │ │  • Bounded Repair (≤2)  │
        └────────────┬────────────┘ └─────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  SQLite / PostgreSQL DB │
        │  • Dataset Metadata     │
        │  • Analysis History     │
        │  • Generated Reports    │
        └─────────────────────────┘
```

---

## 2. Mathematical Truth & AI Safety Boundary

A core principle of the ABI platform is **Zero Hallucination of Business Metrics**:
- **LLM Boundary**: The Large Language Model acts exclusively as a semantic query planner and text-to-SQL translator. It **never performs arithmetic calculations or direct data generation**.
- **Deterministic Analytics Engine**: All aggregations, statistics, trend regressions, and anomalies are computed by Python (Pandas, NumPy, Scikit-learn) and sandboxed SQLite analytical engines.
- **Safe SQL Sandbox**: Unrestricted SQL is forbidden. Only single-statement analytical `SELECT` queries targeting the specific uploaded dataset are allowed. Semicolons, comments (`--`, `/*`), destructive keywords (`DROP`, `DELETE`, `UPDATE`, `ALTER`, `ATTACH`, `PRAGMA`), and system table access are blocked.
- **Bounded Tool Calling**: Tools run in a strictly registered registry with typed Pydantic contracts and a maximum of 2 retry attempts for argument repair.

---

## 3. Team Ownership Breakdown

| Developer | Role & Subsystem | Key Deliverables |
|---|---|---|
| **Developer 1** | **Data Engineering, Analytics & ML** | • Ingestion engine (`CSV`/`XLSX` up to 50MB, column sanitization)<br>• Schema inference & data quality health scoring<br>• KPI engine (sum, mean, min, max, margins, period-over-period)<br>• Time-series trend detection & velocity classification<br>• Unsupervised outlier detection using `IsolationForest`<br>• Grouped multidimensional aggregations |
| **Developer 2** | **AI Agent, SQL & Backend** | • FastAPI application architecture & REST router<br>• Server-side LLM provider adapter (OpenAI / Mock fallback)<br>• Agent planner & bounded tool router<br>• Safe text-to-SQL parser & sandboxed executor<br>• Result validator (Recharts spec & insight generation)<br>• Analysis query lifecycle & audit history persistence<br>• Executive report generator & penetration security suite |
| **Developer 3** | **Frontend & Executive Reporting** | • Modern dark-mode responsive React application<br>• Drag-and-drop dataset upload with progress & validation<br>• Dataset profiling & quality warning screens<br>• Natural language query chat with suggestion pills & thinking states<br>• Declarative Recharts renderer (Bar, Line, Area, Scatter, Pie, KPI)<br>• Full executive briefing preview & JSON/Markdown export |

---

## 4. Quickstart & Local Setup

### Prerequisites
- Python 3.11+ or 3.14
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run FastAPI backend server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be accessible at: `http://localhost:8000/docs`

### 2. Frontend Setup (React + Vite)
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```
Frontend UI will be accessible at: `http://localhost:5173`

> **Note**: By default, the frontend is configured with `VITE_USE_MOCK=false` to communicate with the live FastAPI backend. It also supports standalone mock mode (`VITE_USE_MOCK=true`) for zero-backend demos.

### 3. Streamlit BI Dashboard (All-in-One Alternative)
```bash
# Run the Streamlit application
streamlit run app.py
```
Streamlit app will open at: `http://localhost:8501`

---

## 5. Running the Test Suites

### Backend Tests (69 passed)
```bash
python -m pytest backend/tests/ -v
```
Test suite coverage:
- `test_ingestion.py`: CSV/XLSX validation, byte stream parsing, size limits, corrupted header rejection.
- `test_profiler.py`: Column type inference, missingness rates, duplicate rows, quality scoring.
- `test_kpi.py`: Deterministic KPI verification against hand-calculated mathematical truth.
- `test_trends.py`: Time-series resampling, velocity, growth rate, trajectory classification.
- `test_anomalies.py`: Multi-dimensional Isolation Forest outlier detection on synthetic datasets.
- `test_safe_sql.py`: Safe SQL generation, AST token filtering, destructive keyword blocking, limit enforcement.
- `test_agent_planner.py`: Planner tool selection, tool router execution, result validation.
- `test_query_lifecycle.py`: Query lifecycle, retry repair, history persistence, executive report generation.
- `test_security.py`: Penetration suite testing SQL injection, path traversal, unknown IDs, and secret masking.

### Frontend Tests (39 passed)
```bash
cd frontend
npm test
```
Test suite coverage:
- Upload file validation (format & size boundaries)
- Declarative chart specification schema verification
- Query submit button guard logic
- API client mock adapters & real backend normalizers
- Executive report serialization and JSON export

---

## 6. End-to-End Verification Flow

1. **Upload Dataset**: Upload `data/fixtures/synthetic_business_data.csv` (250 sales records across 4 regions and 4 products).
2. **Review Profile**: View data types, missing value percentages, and the 100/100 Data Health Score.
3. **Ask Business Questions**:
   - *"Which region generated the highest revenue?"* → Agent executes `run_safe_sql` / `summarize_grouped_metrics` and returns verified revenue rankings.
   - *"Show monthly revenue trend over time"* → Agent executes `detect_trends` and produces an Area/Line chart.
   - *"Find unusual transactions or outliers"* → Agent executes `detect_anomalies` using `IsolationForest` and highlights outlier orders.
4. **Generate Executive Report**: One-click generation synthesizes all findings into a structured report with KPIs, trend findings, risk assessment, and actionable recommendations.
5. **Download Report**: Export as JSON or Markdown briefing.

---

## 7. Deployment Configuration

### Deploying on Streamlit Cloud
1. Push repository to GitHub.
2. Link repository to [Streamlit Community Cloud](https://share.streamlit.io/).
3. Set entrypoint: `app.py`.
4. Add environment variables if using live OpenAI LLM:
   ```dotenv
   LLM_API_KEY=your_api_key
   LLM_MODEL=gpt-4o
   ```

### Deploying on Vercel (Frontend SPA)
The project includes `vercel.json` configured for single-page routing:
```bash
cd frontend
npm run build
```

### GitHub Pages (Demo Mode)
The repository includes `.github/workflows/deploy.yml` for automated static deployments with `HashRouter`.

---

## 8. Implemented vs Deferred Features

### Implemented (P0 Baseline)
- [x] CSV/XLSX Ingestion & Validation
- [x] Automatic Schema & Data Quality Profiling
- [x] Natural Language Question Interface
- [x] Bounded AI Agent Planner & Tool Router
- [x] Safe AST-Validated Text-to-SQL Sandbox
- [x] Deterministic KPI & Statistics Engine
- [x] Time-Series Trend Detection
- [x] Multi-Dimensional Isolation Forest Anomaly Detection
- [x] Interactive Recharts Visualizations
- [x] Executive Report Generation & Download (JSON / Markdown)
- [x] Persistent Analysis Audit History
- [x] Complete Penetration & Unit Test Suites (108 total tests)

### Deferred to Future Releases (P1 / P2)
- Multi-dataset relational joins across multiple workspaces
- Machine learning forecasting (Prophet / ARIMA)
- PDF compilation via headless browser
- Voice query interface
