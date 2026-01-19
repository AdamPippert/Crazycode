# AgentReuse Specification

> Semantic Plan Caching for CrazyCode

## Purpose

AgentReuse provides semantic plan caching that enables the agent to recognize structurally similar tasks and reuse prior successful plans. This reduces redundant reasoning, improves consistency, and accelerates common workflows without losing adaptability.

This subsystem is **deterministic**, **inspectable**, and **cache-first**.

## Design Constraints

- Must not require embedding models in v1
- Must support partial plan reuse (not all-or-nothing)
- Must invalidate stale plans when codebase changes
- Must be auditable (user can see why a plan was reused)
- Must degrade gracefully to full planning if cache miss

## Core Concept

AgentReuse caches **PLANS**, not outputs.

A cached plan represents:

- The structural decomposition of a task
- The agent sequence that executed it
- The decision points and their resolutions
- The artifacts produced

Plans are matched by **semantic signature**, not string equality.

## Data Model

### CachedPlan

| Field             | Type   | Description                  |
| ----------------- | ------ | ---------------------------- |
| `id`              | UUID   | Unique plan identifier       |
| `signature`       | string | Canonical task signature     |
| `features`        | object | Structured matching criteria |
| `steps`           | array  | Ordered plan steps           |
| `agent_sequence`  | array  | Agents involved              |
| `decision_points` | array  | Branching decisions made     |
| `artifacts`       | array  | Output references            |
| `success_count`   | int    | Times reused successfully    |
| `failure_count`   | int    | Times reused unsuccessfully  |
| `last_used`       | string | ISO-8601 timestamp           |
| `created_at`      | string | ISO-8601 timestamp           |
| `invalidated`     | bool   | Whether plan is stale        |

### PlanStep

| Field            | Type   | Description       |
| ---------------- | ------ | ----------------- |
| `index`          | int    | Step order        |
| `action`         | string | Action identifier |
| `agent`          | string | Responsible agent |
| `inputs`         | array  | Required inputs   |
| `outputs`        | array  | Expected outputs  |
| `preconditions`  | array  | Required state    |
| `postconditions` | array  | Resulting state   |

### DecisionPoint

| Field          | Type   | Description             |
| -------------- | ------ | ----------------------- |
| `step_index`   | int    | Where decision occurred |
| `condition`    | string | What was evaluated      |
| `choice`       | string | Which branch taken      |
| `alternatives` | array  | Other options available |

## Signature Extraction

Signatures must enable semantic matching without exact string comparison.

### Signature Structure

```
{verb}-{domain}-{target_type}[-{modifier}]
```

### Normalization Rules

1. Strip user-specific identifiers (paths, names)
2. Canonicalize synonyms (`create` = `add` = `new`)
3. Abstract specific types to categories (`UserService` → `service`)
4. Preserve structural modifiers (`with-tests`, `async`)

### Examples

| User Request                           | Signature                  |
| -------------------------------------- | -------------------------- |
| "Add a REST endpoint for users"        | `create-rest-endpoint`     |
| "Create an API route for products"     | `create-rest-endpoint`     |
| "Write unit tests for the auth module" | `write-unit-tests-module`  |
| "Add tests for UserService"            | `write-unit-tests-service` |
| "Refactor the payment handler"         | `refactor-handler`         |

## Matching Algorithm

### Phase 1: Exact Signature Match

```python
def exact_match(task_signature: str) -> Optional[CachedPlan]:
    return cache.get(signature=task_signature, invalidated=False)
```

### Phase 2: Feature Similarity

If no exact match, compare structured features:

```python
def feature_match(task_features: dict) -> List[CachedPlan]:
    candidates = cache.query(
        language=task_features.get("language"),
        framework=task_features.get("framework"),
        invalidated=False
    )

    scored = []
    for plan in candidates:
        score = jaccard_similarity(plan.features, task_features)
        if score > 0.7:
            scored.append((plan, score))

    return sorted(scored, key=lambda x: -x[1])
```

### Phase 3: Structural Similarity (v2)

Compare plan step structures for partial reuse.

## Cache Operations

### Store

```python
def store_plan(task, plan, outcome):
    signature = extract_signature(task)
    features = extract_features(task)

    cached = CachedPlan(
        id=uuid4(),
        signature=signature,
        features=features,
        steps=plan.steps,
        agent_sequence=plan.agents,
        decision_points=plan.decisions,
        artifacts=plan.outputs,
        success_count=1 if outcome.success else 0,
        failure_count=0 if outcome.success else 1,
        last_used=now(),
        created_at=now(),
        invalidated=False
    )

    cache.save(cached)
```

### Retrieve

```python
def retrieve_plan(task) -> Optional[CachedPlan]:
    signature = extract_signature(task)
    features = extract_features(task)

    # Try exact match first
    if plan := exact_match(signature):
        return plan

    # Fall back to feature similarity
    if matches := feature_match(features):
        return matches[0][0]  # Highest scoring

    return None
```

### Invalidate

Plans are invalidated when:

- Referenced files are modified
- Referenced functions are renamed/deleted
- Framework version changes
- User explicitly invalidates

```python
def invalidate_on_change(changed_files: List[str]):
    affected = cache.query(artifacts__overlap=changed_files)
    for plan in affected:
        plan.invalidated = True
        cache.save(plan)
```

## Plan Adaptation

Cached plans are adapted, not blindly replayed.

### Adaptation Steps

1. **Substitute**: Replace specific identifiers with current task targets
2. **Validate**: Check preconditions still hold
3. **Prune**: Remove steps that don't apply
4. **Extend**: Add steps for new requirements

### Example

Cached plan for `create-rest-endpoint`:

```
1. Create handler function
2. Add route registration
3. Write request validation
4. Add response serialization
5. Write unit tests
```

New task: "Create a REST endpoint for orders with pagination"

Adapted plan:

```
1. Create handler function [target: orders]
2. Add route registration [target: orders]
3. Write request validation [target: orders]
4. Add pagination logic [NEW - from modifier]
5. Add response serialization [target: orders]
6. Write unit tests [target: orders, include pagination]
```

## Storage

**Default path:** `~/.crazycode/plan_cache/`

### Recommended Backend

SQLite with JSON columns for complex fields.

### Schema

```sql
CREATE TABLE cached_plans (
    id TEXT PRIMARY KEY,
    signature TEXT NOT NULL,
    features JSON NOT NULL,
    steps JSON NOT NULL,
    agent_sequence JSON NOT NULL,
    decision_points JSON NOT NULL,
    artifacts JSON NOT NULL,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_used TEXT NOT NULL,
    created_at TEXT NOT NULL,
    invalidated INTEGER DEFAULT 0
);

CREATE INDEX idx_signature ON cached_plans(signature);
CREATE INDEX idx_invalidated ON cached_plans(invalidated);
CREATE INDEX idx_last_used ON cached_plans(last_used);
```

## Reinforcement

### On Success

```python
def reinforce_success(plan_id: str):
    plan = cache.get(plan_id)
    plan.success_count += 1
    plan.last_used = now()
    cache.save(plan)
```

### On Failure

```python
def record_failure(plan_id: str, failure_reason: str):
    plan = cache.get(plan_id)
    plan.failure_count += 1

    # Invalidate if failure rate exceeds threshold
    total = plan.success_count + plan.failure_count
    if total > 3 and plan.failure_count / total > 0.5:
        plan.invalidated = True

    cache.save(plan)
```

## TUI Integration

Show plan reuse status in trace:

```
[plan] create-rest-endpoint
  ↳ reusing cached plan (5 prior successes)
  ↳ adapted: +pagination step
[code] create-rest-endpoint ✓
[test] create-rest-endpoint ✓
```

## Non-Goals

- No cross-project plan sharing
- No ML-based plan generation
- No automatic plan composition
- No versioned plan history

## Success Criteria

- [ ] 60%+ of common tasks hit plan cache
- [ ] Cached plan execution 40% faster than fresh planning
- [ ] Invalidation correctly detects stale plans
- [ ] User can inspect and delete cached plans
- [ ] Adaptation produces valid plans 90%+ of the time
