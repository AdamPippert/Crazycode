# Hierarchical Tasks Specification

> Task Trees with Pause/Resume for CrazyCode

## Purpose

Hierarchical Tasks provides a tree-structured task model that enables complex multi-step workflows to be decomposed, tracked, paused, and resumed across sessions. This allows users to work on large features incrementally while maintaining full context and progress visibility.

This subsystem is **persistent**, **resumable**, and **user-controllable**.

## Design Constraints

- Must survive process restarts and system crashes
- Must support arbitrary nesting depth (with practical limits)
- Must allow partial completion and selective resumption
- Must preserve full context for each task node
- Must enable user override at any level

## Core Concept

Hierarchical Tasks stores work as **TREES**, not flat lists.

Each task can have:

- Parent task (context)
- Child tasks (decomposition)
- Sibling tasks (parallel or sequential)
- Associated state and artifacts

The tree represents the complete structure of work from high-level goal to atomic actions.

## Data Model

### TaskNode

| Field          | Type   | Description                         |
| -------------- | ------ | ----------------------------------- |
| `id`           | UUID   | Unique node identifier              |
| `parent_id`    | UUID   | Parent node (null for root)         |
| `title`        | string | Human-readable summary              |
| `description`  | string | Detailed task description           |
| `status`       | enum   | Current execution status            |
| `priority`     | int    | Execution priority (lower = higher) |
| `created_at`   | string | ISO-8601 creation time              |
| `started_at`   | string | ISO-8601 start time                 |
| `completed_at` | string | ISO-8601 completion time            |
| `paused_at`    | string | ISO-8601 pause time                 |
| `context`      | object | Captured state at pause             |
| `artifacts`    | array  | Produced outputs                    |
| `children`     | array  | Child task IDs                      |
| `metadata`     | object | Custom attributes                   |

### Status Values

| Status        | Description                  |
| ------------- | ---------------------------- |
| `pending`     | Not yet started              |
| `ready`       | Dependencies met, can start  |
| `in_progress` | Currently executing          |
| `paused`      | Manually suspended           |
| `blocked`     | Waiting on dependency        |
| `completed`   | Finished successfully        |
| `failed`      | Finished with error          |
| `cancelled`   | Terminated by user or parent |

### Example Tree

```
root: "Implement user authentication" (in_progress)
├── child_1: "Design auth flow" (completed)
│   ├── leaf_1a: "Define requirements" (completed)
│   └── leaf_1b: "Create sequence diagram" (completed)
├── child_2: "Implement backend" (in_progress)
│   ├── leaf_2a: "Create User model" (completed)
│   ├── leaf_2b: "Implement JWT tokens" (in_progress) ← current
│   └── leaf_2c: "Add password hashing" (pending)
├── child_3: "Implement frontend" (blocked)
│   └── [depends on child_2]
└── child_4: "Write tests" (pending)
```

## Tree Operations

### Create Root Task

```python
def create_task(title: str, description: str) -> TaskNode:
    return TaskNode(
        id=uuid4(),
        parent_id=None,
        title=title,
        description=description,
        status="pending",
        priority=0,
        created_at=now(),
        children=[]
    )
```

### Decompose Task

```python
def decompose(parent: TaskNode, subtasks: List[dict]) -> List[TaskNode]:
    children = []
    for i, spec in enumerate(subtasks):
        child = TaskNode(
            id=uuid4(),
            parent_id=parent.id,
            title=spec["title"],
            description=spec.get("description", ""),
            status="pending",
            priority=i,
            created_at=now(),
            children=[]
        )
        children.append(child)
        parent.children.append(child.id)

    return children
```

### Pause Task

```python
def pause(task: TaskNode, context: dict):
    task.status = "paused"
    task.paused_at = now()
    task.context = context  # Capture resumption state

    # Recursively pause active children
    for child_id in task.children:
        child = get_task(child_id)
        if child.status == "in_progress":
            pause(child, child.get_current_context())
```

### Resume Task

```python
def resume(task: TaskNode) -> dict:
    if task.status != "paused":
        raise InvalidStateError("Task not paused")

    task.status = "in_progress"
    context = task.context
    task.context = None  # Clear stored context

    return context  # Return state for agent to continue
```

### Complete Task

```python
def complete(task: TaskNode, artifacts: List[str]):
    task.status = "completed"
    task.completed_at = now()
    task.artifacts.extend(artifacts)

    # Check if parent can progress
    parent = get_task(task.parent_id) if task.parent_id else None
    if parent and all_children_completed(parent):
        # Parent may now be completable
        check_parent_completion(parent)
```

## Context Preservation

### Captured Context

When pausing, capture:

| Component           | Description                   |
| ------------------- | ----------------------------- |
| `current_step`      | Which step was active         |
| `agent_state`       | Active agent's internal state |
| `file_states`       | Checksums of relevant files   |
| `variables`         | Working variables             |
| `decision_history`  | Choices made so far           |
| `pending_questions` | Unanswered clarifications     |

### Context Restoration

When resuming:

1. Validate file states match (warn if changed)
2. Restore agent state
3. Present decision history summary to user
4. Continue from `current_step`

## Dependency Management

### Dependency Types

| Type         | Meaning                             |
| ------------ | ----------------------------------- |
| `sequential` | Must complete before next sibling   |
| `parallel`   | Can execute alongside siblings      |
| `blocks`     | Must complete before specified task |
| `requires`   | Needs output from specified task    |

### Dependency Resolution

```python
def is_ready(task: TaskNode) -> bool:
    # Check explicit dependencies
    for dep_id in task.metadata.get("requires", []):
        dep = get_task(dep_id)
        if dep.status != "completed":
            return False

    # Check sequential sibling ordering
    if task.metadata.get("sequential", True):
        siblings = get_siblings(task)
        for sib in siblings:
            if sib.priority < task.priority:
                if sib.status not in ("completed", "cancelled"):
                    return False

    return True
```

## User Controls

### TUI Commands

| Command              | Action                      |
| -------------------- | --------------------------- |
| `/pause`             | Pause current task          |
| `/resume [id]`       | Resume paused task          |
| `/status`            | Show task tree status       |
| `/focus [id]`        | Switch to specific subtask  |
| `/skip [id]`         | Mark task as skipped        |
| `/cancel [id]`       | Cancel task and descendants |
| `/priority [id] [n]` | Change task priority        |

### Override Behavior

Users can:

- Pause any in-progress task
- Resume any paused task
- Skip any pending task
- Cancel any non-completed task
- Reorder sibling priorities
- Add new subtasks to any node

## Storage

**Default path:** `~/.crazycode/tasks/`

### File Structure

```
~/.crazycode/tasks/
├── active/
│   └── {task_id}.json      # Currently active root tasks
├── paused/
│   └── {task_id}.json      # Paused root tasks
├── completed/
│   └── {task_id}.json      # Completed root tasks (retained 30 days)
└── index.db                # SQLite index for queries
```

### Schema

```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    paused_at TEXT,
    FOREIGN KEY (parent_id) REFERENCES tasks(id)
);

CREATE INDEX idx_status ON tasks(status);
CREATE INDEX idx_parent ON tasks(parent_id);
```

## TUI Visualization

### Tree View

```
┌─ Implement user authentication ─────────────────────────┐
│ Status: in_progress (2/4 complete)                      │
├─────────────────────────────────────────────────────────┤
│ ✓ Design auth flow                                      │
│   ✓ Define requirements                                 │
│   ✓ Create sequence diagram                             │
│ ▶ Implement backend                          [60%]      │
│   ✓ Create User model                                   │
│   ▶ Implement JWT tokens                     ← current  │
│   ○ Add password hashing                                │
│ ◌ Implement frontend                         [blocked]  │
│ ○ Write tests                                           │
└─────────────────────────────────────────────────────────┘
```

### Legend

| Symbol | Meaning     |
| ------ | ----------- |
| ✓      | Completed   |
| ▶     | In progress |
| ○      | Pending     |
| ◌      | Blocked     |
| ⏸     | Paused      |
| ✗      | Failed      |
| ⊘      | Cancelled   |

## Session Management

### Auto-Pause on Exit

```python
def on_session_end():
    for task in get_active_tasks():
        if task.status == "in_progress":
            pause(task, task.get_current_context())
            save_task(task)
```

### Session Restore Prompt

```
CrazyCode found paused tasks:

1. [paused 2h ago] Implement user authentication (60%)
   Last: Implementing JWT tokens

2. [paused 1d ago] Refactor payment module (30%)
   Last: Extracting validation logic

Resume a task? [1/2/new/list]
```

## Non-Goals

- No automatic task generation from codebase analysis
- No cross-machine task synchronization
- No task templates or presets
- No time tracking or estimation

## Success Criteria

- [ ] Tasks survive process restart without data loss
- [ ] Resume restores exact context in < 2 seconds
- [ ] Tree visualization updates in real-time
- [ ] User can pause/resume any task via TUI
- [ ] Nested tasks correctly propagate status changes
