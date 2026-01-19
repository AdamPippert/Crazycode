# Evo-Memory Specification

> Self-Evolving Experience Memory for CrazyCode

## Purpose

Evo-Memory provides persistent, self-evolving experience memory for CrazyCode. It allows the system to reuse successful strategies, adapt to user patterns, and reduce redundant reasoning across sessions without expanding prompt context.

This subsystem is **local-first**, **inspectable**, and **deterministic** by default.

## Design Constraints

- Must work without network access
- Must not require model fine-tuning
- Must not increase prompt size linearly over time
- Must be auditable and user-inspectable
- Must degrade gracefully if empty or corrupted

## Core Concept

Evo-Memory stores **EXPERIENCES**, not conversations.

An experience represents:

- A task signature
- The conditions under which it occurred
- The actions taken
- The outcome
- A confidence score

Experiences are retrieved to **BIAS** planning, never to dictate actions.

## Data Model

Each experience is stored as a single record.

### Fields

| Field            | Type   | Description                             |
| ---------------- | ------ | --------------------------------------- |
| `id`             | UUID   | Unique identifier                       |
| `task_signature` | string | Short canonical identifier              |
| `features`       | object | Structured metadata describing the task |
| `actions`        | array  | Ordered list of actions taken           |
| `artifacts`      | array  | References to files, logs, or outputs   |
| `outcome`        | enum   | `success` \| `failure` \| `partial`     |
| `confidence`     | float  | Value between 0.0 and 1.0               |
| `timestamp`      | string | ISO-8601 timestamp                      |

### Example

```json
{
  "id": "a8f1c2...",
  "task_signature": "debug-python-import-error",
  "features": {
    "language": "python",
    "framework": "none",
    "error_type": "ImportError"
  },
  "actions": ["inspect sys.path", "add __init__.py", "adjust relative import"],
  "artifacts": ["file:src/foo.py", "log:traceback.txt"],
  "outcome": "success",
  "confidence": 0.91,
  "timestamp": "2026-01-10T18:42:00Z"
}
```

## Storage

**Default path:** `~/.crazycode/memory/`

### Recommended Backends

1. **SQLite** (preferred)
2. **JSONL** (fallback)

### Indexes

- `task_signature`
- `features.language`
- `features.framework`
- `outcome`

## Task Signature Extraction

Task signatures must be:

- Short
- Deterministic
- Stable across sessions

### Rules

- Format: `verb-domain-error/type`
- No user-specific names
- No file paths

### Examples

- `build-rest-api`
- `debug-python-import-error`
- `refactor-react-component`
- `write-unit-tests`

## Retrieval Flow

```
1. New task arrives
2. Extract task_signature and features
3. Retrieve top-K similar experiences
4. Sort by confidence and recency
5. Provide to planner as OPTIONAL context
```

### Planner Usage Rules

- Use as hints only
- Never copy actions verbatim
- Never override user intent

## Update / Reinforcement Flow

After task completion:

1. Capture final actions
2. Record outcome
3. Assign confidence score
4. Persist new experience

### Confidence Guidance

| Scenario                       | Confidence Range |
| ------------------------------ | ---------------- |
| Success + no user intervention | 0.8–1.0          |
| Success + user fixes           | 0.5–0.8          |
| Failure                        | 0.0–0.3          |

## Non-Goals

- No cross-user sharing
- No autonomous background learning
- No opaque embeddings in v1
- No cloud sync

## Success Criteria

- [ ] Repeated tasks retrieve prior experiences
- [ ] Planner latency decreases on common tasks
- [ ] Memory persists across sessions
- [ ] User can inspect and delete memory entries
