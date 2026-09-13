# Execution Decisions

## 1. Priority

P0 must be completed before P1/P2.

### P0
- ingestion
- profiling
- safe AI agent
- safe SQL
- analytics
- anomaly detection
- visualization
- executive report
- tests
- deployment

### P1
- forecasting
- segmentation
- multiple datasets
- scheduled reports
- PDF export

### P2
- voice
- advanced memory
- enterprise connectors
- heavy visual polish

## 2. AI boundary

The LLM proposes analysis actions. Deterministic backend tools perform calculations.

This separation is intentional:
- LLM: interpretation/planning
- Python/SQL: computation
- backend: authorization/validation
- frontend: presentation

## 3. Numerical truth

The application must never allow the LLM to invent a number that was not produced by the analytical engine.

Every displayed business metric should trace back to a computed result.

## 4. SQL safety

Never execute arbitrary SQL directly from an LLM response.

Minimum controls:
- parser/allowlist
- SELECT-only policy
- allowed identifiers
- dataset scoping
- resource limits
- timeout
- error handling

## 5. Anomaly detection

Isolation Forest is the default candidate for the MVP because it can operate without labeled anomaly data. The team must validate it on synthetic examples and explain threshold/contamination assumptions.

## 6. Recommendations

Recommendations should be framed as data-informed suggestions, not guaranteed business decisions.

Example:
“Revenue in Region A declined for three consecutive periods; investigate product mix and order volume.”

Not:
“Close Region A immediately.”

## 7. Vibe-coding policy

AI may generate:
- boilerplate
- UI components
- API scaffolding
- tests
- refactors
- documentation

Developers must review:
- security-sensitive code
- SQL execution
- model/tool routing
- ML algorithms
- database access
- calculations

If a developer cannot explain a code path, it is not interview-ready.

## 8. Team integration

D1 publishes analytics contracts.
D2 publishes API/agent contracts.
D3 builds against those contracts.

Shared contracts are changed only after team agreement.

## 9. If behind schedule

Cut in this order:
1. animations
2. PDF export
3. forecasting
4. segmentation
5. multi-dataset support

Do not cut:
- safe tool execution
- analytics correctness
- real AI integration
- tests
- deployment
