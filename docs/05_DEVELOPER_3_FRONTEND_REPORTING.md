# Developer 3 — Frontend, Visualization & Executive Reporting

## Ownership

Own the user-facing React application, dashboard, data upload experience, chart rendering, insight presentation and executive report interface.

## Working protocol

Work one numbered task at a time. Ask for the team's preferred visual reference before creating a major screen family. Consume D1/D2 contracts rather than inventing API responses.

## Part A — Product shell

### A1. Dashboard layout
Create:
- navigation
- dataset selector
- upload action
- analysis workspace
- history/report access

Include responsive desktop/mobile behavior.

### A2. Upload experience
Show:
- drag/drop or file picker
- supported formats
- upload progress
- validation errors
- successful dataset summary

Acceptance: user always knows whether the dataset was accepted.

### A3. Dataset profile screen
Display:
- rows
- columns
- missing values
- data types
- quality warnings
- representative summaries

## Part B — AI analysis experience

### B1. Natural-language query interface
User can ask questions such as:
- “Which region has the highest revenue?”
- “Show monthly revenue growth.”
- “Find unusual transactions.”

Show processing state without pretending the model has completed before the backend responds.

### B2. Insight cards
Display:
- answer
- supporting metric
- assumptions/warnings
- source dataset
- analysis type

Do not show unsupported claims.

### B3. Analysis history
Show previous questions, status, timestamp and dataset.

## Part C — Visualization

### C1. Chart renderer
Support structured chart specifications:
- line
- bar
- area
- scatter
- KPI cards
- anomaly markers where appropriate

Charts must use backend-computed values.

### C2. Dashboard composition
Create a business overview with:
- revenue
- profit
- growth
- top categories
- anomalies
- trends

Only show cards when the dataset contains appropriate fields.

## Part D — Executive reporting

### D1. Report preview
Create a report containing:
- executive summary
- KPI section
- major trends
- anomaly section
- charts
- recommendations
- data-quality warnings

### D2. Report generation
Call D2's report endpoint and show generation status.

Acceptance: report content is based on the actual analysis result, not hard-coded demo claims.

### D3. Export
If P0 is stable, implement a simple downloadable report. PDF export is P1 if it risks the core schedule.

## Part E — Integration QA

Test:
- upload → profile
- question → result
- result → chart
- analysis → report
- backend errors
- empty results
- mobile layout

## Interview readiness

Be able to explain:
- React state/data flow
- REST API integration
- chart specification design
- loading/error states
- how frontend avoids trusting AI output directly
- how report content is tied to backend results
