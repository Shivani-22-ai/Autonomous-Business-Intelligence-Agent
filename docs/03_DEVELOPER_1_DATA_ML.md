# Developer 1 — Data Engineering, Analytics & ML

## Ownership

Own dataset ingestion, profiling, analytical functions, anomaly detection and ML/analytics correctness. Provide stable typed tools that Developer 2's agent can call and Developer 3's UI can visualize.

## Working protocol

Work one numbered task at a time. State files, assumptions and acceptance test. Implement, test and pause for approval. Do not change shared API contracts without agreement.

## Part A — Data foundation

### A1. Dataset ingestion
- Accept CSV/XLSX.
- Validate size, extension and readable structure.
- Assign dataset_id.
- Normalize safe column metadata.
- Reject malformed/empty datasets.

Acceptance: a valid synthetic business dataset can be loaded and profiled.

### A2. Automatic profiling
Generate:
- row/column counts
- data types
- missing-value counts
- unique counts
- basic statistics
- likely date/numeric/categorical columns
- duplicate-row summary

Acceptance: profiler works without assuming a fixed column naming convention.

### A3. Data-quality tests
Cover:
- empty file
- duplicate columns
- missing values
- invalid dates
- mixed types
- extreme numeric values

## Part B — Analytics engine

### B1. KPI engine
Support configurable:
- sum
- average
- count
- distinct count
- minimum/maximum
- margin where required fields exist
- period-over-period growth

Do not invent a KPI when the necessary columns are absent.

### B2. Trend detection
Given a time column and metric:
- aggregate by a sensible time period
- calculate change/growth
- identify significant upward/downward movement
- return structured results with supporting values

### B3. Anomaly detection
Implement a bounded anomaly detector, such as Isolation Forest, for suitable numeric features.

Explain and document:
- why the method is appropriate
- preprocessing
- contamination/threshold assumptions
- limitations
- how results are surfaced

Acceptance: synthetic data containing known unusual observations produces useful anomaly candidates.

### B4. Grouped business analysis
Support questions such as:
- revenue by region
- profit by product
- orders by month
- top/bottom categories

## Part C — Agent tools

Expose safe registered analytical functions to D2.

Each function must:
- receive validated arguments
- access only the requested dataset
- return typed results
- include warnings when assumptions are made
- never execute arbitrary user code

### C1. Tool fixtures
Create deterministic fixture datasets and expected outputs.

### C2. Integration handoff
Provide D2 with tool signatures and examples. Provide D3 with result structures and chart-friendly data.

## Part D — Interview readiness

Be able to explain:
- Pandas data pipeline
- EDA
- missing values
- aggregation
- trend calculation
- Isolation Forest
- why anomaly detection is unsupervised
- false positives/limitations
- how analytics results are validated

## Stop conditions

Do not mark analytics complete because a chart renders. Verify numerical outputs against hand-checked fixture cases.
