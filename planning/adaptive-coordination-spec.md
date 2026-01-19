# Adaptive Coordination Specification

> Parallel Agents and Runtime Rerouting for CrazyCode

## Purpose

Adaptive Coordination enables CrazyCode to run multiple agents in parallel, dynamically reroute execution based on intermediate results, and revise upstream decisions when downstream agents discover blocking issues. This transforms the linear orchestration loop into a responsive, efficient execution graph.

This subsystem is **observable**, **interruptible**, and **deadlock-free**.

## Design Constraints

- Must maintain deterministic replay from logs
- Must never exceed configured parallelism limits
- Must preserve user visibility into all parallel branches
- Must handle partial failures without cascading
- Must support graceful degradation to sequential execution

## Core Concept

Adaptive Coordination treats execution as a **DYNAMIC DAG**, not a fixed pipeline.

The system:
1. Identifies independent subtasks that can parallelize
2. Monitors execution progress across branches
3. Propagates signals upstream when revision is needed
4. Rebalances work based on resource availability

## Execution Model

### Task Graph

```
          ┌──────────────┐
          │    PLANNER   │
          └──────┬───────┘
                 │ plan
       ┌─────────┼─────────┐
       ▼         ▼         ▼
   ┌──────┐  ┌──────┐  ┌──────┐
   │CODER │  │CODER │  │CODER │  ← parallel
   │ (A)  │  │ (B)  │  │ (C)  │
   └──┬───┘  └──┬───┘  └──┬───┘
      │         │         │
      ▼         ▼         ▼
   ┌──────┐  ┌──────┐  ┌──────┐
   │ EVAL │  │ EVAL │  │ EVAL │  ← parallel
   │ (A)  │  │ (B)  │  │ (C)  │
   └──┬───┘  └──┬───┘  └──┬───┘
      │         │         │
      └─────────┼─────────┘
                ▼ join
          ┌──────────────┐
          │   EXECUTOR   │
          └──────────────┘
```

### Node States

| State | Description |
|-------|-------------|
| `pending` | Not yet started |
| `ready` | Dependencies satisfied, can start |
| `running` | Currently executing |
| `completed` | Finished successfully |
| `failed` | Finished with error |
| `blocked` | Waiting on upstream revision |
| `cancelled` | Terminated by upstream failure |

### Edge Types

| Type | Meaning |
|------|---------|
| `depends_on` | Must complete before this node starts |
| `feeds_into` | Output flows to downstream node |
| `revises` | Failure triggers upstream replanning |

## Parallelism Detection

### Independent Subtask Criteria

Two subtasks are independent if:
1. No shared file dependencies
2. No shared state mutations
3. No ordering requirements in plan

### Detection Algorithm

```python
def find_parallel_groups(plan: Plan) -> List[List[Step]]:
    groups = []
    current_group = []

    for step in plan.steps:
        if can_parallelize(step, current_group):
            current_group.append(step)
        else:
            if current_group:
                groups.append(current_group)
            current_group = [step]

    if current_group:
        groups.append(current_group)

    return groups

def can_parallelize(step: Step, group: List[Step]) -> bool:
    step_files = set(step.inputs + step.outputs)
    group_files = set()
    for s in group:
        group_files.update(s.inputs + s.outputs)

    # No file overlap allowed
    if step_files & group_files:
        return False

    # No explicit ordering dependency
    if any(step.depends_on(s) for s in group):
        return False

    return True
```

## Runtime Rerouting

### Trigger Conditions

| Condition | Action |
|-----------|--------|
| Subtask fails | Pause siblings, signal upstream |
| Confidence drops below threshold | Request user input |
| Resource exhaustion | Throttle parallelism |
| New information invalidates plan | Trigger replanning |

### Rerouting Flow

```
1. Agent B fails with "missing dependency X"
2. Coordinator pauses Agent C (sibling)
3. Coordinator signals PLANNER: "step B blocked on X"
4. PLANNER revises plan: add step to create X before B
5. Coordinator restarts B and C with revised plan
```

### Upstream Revision Protocol

```python
class RevisionRequest:
    source_step: str      # Which step failed
    reason: str           # Why it failed
    suggestion: str       # Optional fix hint
    blocking: bool        # Must resolve before continuing

def handle_failure(step: Step, error: Error):
    if error.is_transient:
        retry(step, max_attempts=2)
    elif error.suggests_plan_fix:
        request = RevisionRequest(
            source_step=step.id,
            reason=error.message,
            suggestion=error.fix_hint,
            blocking=True
        )
        send_to_planner(request)
        pause_downstream(step)
    else:
        cancel_branch(step)
```

## Coordination State

### Coordinator Data Model

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | UUID | Parent task identifier |
| `graph` | DAG | Current execution graph |
| `active_nodes` | set | Currently running nodes |
| `completed_nodes` | set | Finished nodes |
| `pending_revisions` | queue | Upstream revision requests |
| `parallelism_limit` | int | Max concurrent agents |
| `resource_usage` | dict | Current resource consumption |

### Graph Operations

```python
class Coordinator:
    def schedule_next(self) -> List[Node]:
        """Return nodes ready to execute."""
        ready = []
        for node in self.graph.nodes:
            if node.state == "pending":
                if all(dep.state == "completed"
                       for dep in node.dependencies):
                    ready.append(node)

        # Respect parallelism limit
        available_slots = self.parallelism_limit - len(self.active_nodes)
        return ready[:available_slots]

    def handle_completion(self, node: Node, result: Result):
        """Process node completion."""
        node.state = "completed"
        node.result = result
        self.active_nodes.remove(node)

        # Check if this unblocks downstream
        for successor in node.successors:
            if all(dep.state == "completed"
                   for dep in successor.dependencies):
                successor.state = "ready"

    def handle_failure(self, node: Node, error: Error):
        """Process node failure."""
        node.state = "failed"
        node.error = error
        self.active_nodes.remove(node)

        # Cancel downstream
        for successor in node.successors:
            if successor.state in ("pending", "ready"):
                successor.state = "cancelled"

        # Request upstream revision if applicable
        if error.is_recoverable:
            self.pending_revisions.put(RevisionRequest(
                source_step=node.id,
                reason=str(error),
                blocking=True
            ))
```

## TUI Visualization

### Parallel Progress Display

```
[plan] create-feature ✓

[parallel] 3 agents
  ├─ [code] component-a ████████░░ 80%
  ├─ [code] component-b ██████████ 100% ✓
  └─ [code] component-c ███░░░░░░░ 30%
      ↳ blocked: waiting on shared-types

[waiting] join point (2/3 complete)
```

### Rerouting Notification

```
[code] component-c ✗ missing SharedTypes
  ↳ signaling upstream revision

[replan] adding step: generate-shared-types
  ↳ restarting: component-c

[code] generate-shared-types ✓
[code] component-c ██████████ 100% ✓
```

## Resource Management

### Limits

| Resource | Default Limit | Configurable |
|----------|---------------|--------------|
| Concurrent agents | 4 | Yes |
| Memory per agent | 512MB | Yes |
| Execution timeout | 5 min/step | Yes |
| Retry attempts | 2 | Yes |

### Throttling

```python
def should_throttle() -> bool:
    if len(active_nodes) >= parallelism_limit:
        return True
    if system_memory_usage() > 0.8:
        return True
    if pending_revisions.size() > 0:
        return True  # Pause new work during replanning
    return False
```

## Deadlock Prevention

### Detection

```python
def detect_deadlock() -> bool:
    # All active nodes are blocked
    if all(n.state == "blocked" for n in active_nodes):
        return True

    # Circular dependency in pending revisions
    if has_cycle(pending_revisions):
        return True

    return False
```

### Resolution

1. Identify the cycle or mutual block
2. Cancel the lowest-priority branch
3. Escalate to user if no safe resolution

## Non-Goals

- No distributed execution across machines
- No speculative execution
- No automatic scaling beyond configured limits
- No learning-based scheduling

## Success Criteria

- [ ] 2x speedup on parallelizable tasks vs sequential
- [ ] Upstream revision resolves 80% of blocking failures
- [ ] No deadlocks in 1000 random execution graphs
- [ ] User can understand parallel state from TUI
- [ ] Graceful degradation when resources constrained
