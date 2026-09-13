# Antigravity Handoff — Three Developer Setup

## Give every developer

- 00_START_HERE.md
- 01_MASTER_PLAN.md
- 02_TECHNICAL_CONTRACTS.md
- 06_VERIFICATION_DEMO.md
- 07_EXECUTION_DECISIONS.md
- this file
- ONLY their own developer file

## Launch prompt

You are implementing the Autonomous Business Intelligence Agent as Developer [1/2/3]. Read all supplied project files completely and inspect the existing checkout before changing it.

Follow your developer file from Part A to Part B to Part C. Break large tasks into 15–30 minute verified slices.

For every slice:
1. State the task and files.
2. State assumptions and dependencies.
3. Implement it.
4. Run the relevant tests/checks.
5. Report exactly what passed, failed or is blocked.
6. Wait for approval before continuing.

## Non-negotiable rules

- Do not invent successful tests.
- Do not invent model responses or business insights.
- Do not put credentials in code.
- Do not execute arbitrary SQL/code from model output.
- Do not overwrite existing project code blindly.
- Do not modify another developer's ownership without agreement.
- Do not change shared contracts silently.
- Use synthetic/demo data only.
- Keep AI decisions concise and auditable; never expose hidden chain-of-thought.

## Progress file

Each developer maintains:

```text
docs/progress/developer-1.md
docs/progress/developer-2.md
docs/progress/developer-3.md
```

Record:
- current task
- status
- files changed
- tests/commands
- actual results
- blockers
- dependency handoffs
- next task

## Integration checkpoints

### Checkpoint 1
D1: ingestion + profiler fixture
D2: backend + provider fixture
D3: frontend shell + upload UI

### Checkpoint 2
D1: KPI/trend/anomaly tools
D2: agent + safe SQL
D3: analysis results + charts

### Checkpoint 3
Full flow:
upload → profile → question → agent → tool → result → chart → executive report

### Final

Run the complete verification matrix. Only then call the project complete.

The final README must distinguish implemented, simulated, deferred and known limitations.
