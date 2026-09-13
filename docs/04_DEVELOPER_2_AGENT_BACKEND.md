# Developer 2 — AI Agent, SQL & Backend

## Ownership

Own FastAPI, database integration, LLM provider adapter, agent orchestration, safe SQL generation/execution, tool permissions and analysis history.

## Working protocol

Work one numbered task at a time. Coordinate contracts with D1 and D3. Never allow an LLM to bypass backend validation.

## Part A — Backend foundation

### A1. FastAPI baseline
- Create project structure.
- Configure environment variables.
- Add health endpoint.
- Add type checking/lint/test commands.
- Establish error response format.

Acceptance: clean local startup and test request.

### A2. Dataset metadata persistence
Store dataset metadata, schema and analysis history.

Acceptance: uploaded dataset can be referenced by dataset_id without exposing arbitrary filesystem paths.

### A3. Provider adapter
Create one server-side LLM adapter.

Requirements:
- configurable model
- timeout
- bounded retries
- structured output validation
- provider errors visible
- no secrets in logs

Acceptance: real provider request works when credentials are supplied; fixture responses are used for deterministic tests.

## Part B — AI agent

### B1. Agent planner
Input:
- dataset schema/profile
- user question
- permitted tools

Output:
- selected tool
- validated parameters
- concise rationale
- warnings

The model must not directly execute code.

### B2. Text-to-SQL
Implement SQL generation for supported analytical patterns.

Safety:
- allow only SELECT-style analytical queries
- validate referenced tables/columns
- bind dataset context
- reject destructive statements
- impose row/time/resource limits
- reject unknown identifiers

Acceptance: natural-language questions become correct SQL for fixture datasets, while malicious SQL is rejected.

### B3. Tool router
Connect D1's:
- KPI tools
- trend tools
- anomaly detector
- grouped analysis
- profiling tools

The router should call only registered tools.

### B4. Result validation
Before returning a result:
- validate schema
- verify required fields
- capture warnings
- handle empty results
- handle tool failure

## Part C — Autonomous BI workflow

### C1. Query lifecycle
Implement:

question
→ plan
→ tool call
→ execution
→ validation
→ insight payload
→ chart specification
→ report-ready result

### C2. Retry/recovery
If the model produces invalid tool arguments:
- do bounded repair
- retry only within a fixed limit
- otherwise return a clear failure

Never loop indefinitely.

### C3. Analysis history
Persist:
- question
- dataset
- tool
- execution status
- latency
- result reference
- concise explanation
- warnings

Do not persist hidden chain-of-thought.

## Part D — Backend security

Test:
- arbitrary SQL injection
- unknown dataset_id
- path traversal
- oversized input
- malicious prompt asking for secrets
- unauthorized dataset access

## Part E — Interview readiness

Be able to explain:
- LLM vs deterministic analytics
- agent architecture
- tool calling
- text-to-SQL
- SQL injection
- validation
- retries
- why the LLM should not execute arbitrary code
- how the backend guarantees that insights come from computed data
