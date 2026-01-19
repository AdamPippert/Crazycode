# Minimal Agent Orchestration Loop

> CrazyCode v0 Orchestration Specification

## Purpose

This document defines the first operational agent orchestration loop for CrazyCode.

The goal is to enable:

- Deterministic delegation
- Clear routing
- Safe execution
- Full auditability in a TUI environment

This is **NOT** a fully autonomous system. User oversight is preserved at all times.

## Core Agents

The v0 system consists of four agents:

### 1. PLANNER

- Decomposes tasks
- Reuses cached plans
- Consumes Evo-Memory as bias

### 2. CODER

- Generates or modifies code
- Does **not** execute code

### 3. EVALUATOR

- Checks syntax
- Runs static checks
- Assigns confidence score

### 4. EXECUTOR

- Runs code in a sandbox
- Captures artifacts
- Never generates code

## Shared Task State

All agents read and write to a shared task state.

### Required Fields

| Field          | Description                    |
| -------------- | ------------------------------ |
| `task_id`      | Unique task identifier         |
| `user_input`   | Original user request          |
| `plan`         | Decomposed task plan           |
| `current_step` | Current execution step         |
| `artifacts`    | Generated files, logs, outputs |
| `confidence`   | Current confidence score       |
| `status`       | Task status                    |
| `history`      | Execution history              |

State must be **serializable** and **resumable**.

## Orchestration Loop

The orchestration loop is sequential and rule-based.

### Pseudocode

```python
initialize state from user_input

plan = PLANNER(state, evo_memory)
state.plan = plan

while state.status != DONE:
    agent = select_next_agent(state)
    result = agent.execute(state)
    state.update(result)

    if result.failure:
        route upstream to PLANNER

    if result.confidence < threshold:
        request user confirmation

finalize state
persist Evo-Memory entry
```

## Agent Selection Rules (v0)

1. PLANNER always runs first
2. CODER runs after PLANNER
3. EVALUATOR always runs before EXECUTOR
4. EXECUTOR only runs if confidence >= threshold
5. Any failure routes back to PLANNER

```
[PLANNER] → [CODER] → [EVALUATOR] → [EXECUTOR]
     ↑                                   │
     └───────── on failure ──────────────┘
```

## Confidence Gating

Confidence is a numeric value between 0.0 and 1.0.

### Thresholds

| Range   | Action             |
| ------- | ------------------ |
| >= 0.8  | Auto-proceed       |
| 0.5–0.8 | Prompt user        |
| < 0.5   | Reroute to planner |

Confidence must be **visible** to the user.

## TUI Trace Requirements

Every step must be visible in the TUI.

### Example Output

```
[plan] create-api-endpoint ✓
[code] create-api-endpoint ✓
[test] create-api-endpoint ✗
  ↳ rerouting to planner
```

**No hidden agent actions.**

## Failure Handling

Failures are not retried blindly.

### Rules

- One failure triggers replanning
- Replanning must consider prior failure
- Infinite loops are forbidden

## Non-Goals

- No background autonomous execution
- No parallel agents in v0
- No learning-based routing yet
- No GUI abstractions

## Success Criteria

- [ ] Task state survives interruption
- [ ] Failures reroute deterministically
- [ ] Code never executes without evaluation
- [ ] User can understand every step from logs
