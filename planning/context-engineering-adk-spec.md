# Context Engineering (ADK) Specification

> Artifact System for CrazyCode

## Purpose

Context Engineering provides the Artifact Development Kit (ADK)—a structured system for managing, compiling, and optimizing context that flows between agents and across sessions. This ensures agents receive precisely the context they need without token bloat, while preserving critical information for long-running tasks.

This subsystem is **composable**, **compressible**, and **auditable**.

## Design Constraints

- Must not grow context size linearly with session length
- Must preserve semantic completeness despite compression
- Must support incremental updates without full recomputation
- Must enable context sharing between agents
- Must be inspectable and exportable

## Core Concept

Context Engineering treats context as **COMPILED ARTIFACTS**, not raw history.

The system:
1. Captures structured artifacts from agent outputs
2. Compiles context tailored to each agent's needs
3. Compresses and prunes stale information
4. Maintains semantic integrity across transformations

## Artifact Model

### Artifact Types

| Type | Description | Example |
|------|-------------|---------|
| `code` | Source code or diff | Function definition, patch |
| `plan` | Structured plan | Task decomposition |
| `decision` | Choice with rationale | Architecture selection |
| `fact` | Discovered information | API endpoint, schema |
| `error` | Failure with context | Stack trace, diagnosis |
| `user_input` | User clarification | Preference, requirement |
| `summary` | Compressed context | Session summary |

### Artifact Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `type` | enum | Artifact type |
| `content` | string | Primary content |
| `metadata` | object | Structured attributes |
| `references` | array | Related artifact IDs |
| `created_at` | string | ISO-8601 timestamp |
| `expires_at` | string | Optional expiration |
| `priority` | float | Retention priority (0.0–1.0) |
| `agent` | string | Creating agent |
| `compressed` | bool | Whether content is compressed |

### Example Artifacts

```json
{
  "id": "art_001",
  "type": "decision",
  "content": "Use JWT for authentication instead of sessions",
  "metadata": {
    "alternatives": ["sessions", "OAuth only"],
    "rationale": "Stateless scaling, mobile compatibility",
    "confidence": 0.85
  },
  "references": ["art_000"],
  "created_at": "2026-01-10T14:30:00Z",
  "priority": 0.9,
  "agent": "PLANNER"
}
```

```json
{
  "id": "art_002",
  "type": "code",
  "content": "def authenticate(token: str) -> User:\n    ...",
  "metadata": {
    "language": "python",
    "file": "src/auth.py",
    "lines": [15, 42],
    "change_type": "create"
  },
  "references": ["art_001"],
  "created_at": "2026-01-10T14:35:00Z",
  "priority": 0.8,
  "agent": "CODER"
}
```

## Context Compilation

### Compiler Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                  Artifact Store                          │
│  (all artifacts from session and memory)                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               1. Relevance Filtering                     │
│    (select artifacts matching agent needs)               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               2. Dependency Resolution                   │
│    (include referenced artifacts)                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               3. Priority Sorting                        │
│    (order by priority and recency)                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               4. Token Budgeting                         │
│    (fit within agent's context window)                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               5. Format Rendering                        │
│    (convert to agent-specific format)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Compiled Context                        │
└─────────────────────────────────────────────────────────┘
```

### Agent Context Profiles

Each agent type has a context profile:

```python
@dataclass
class ContextProfile:
    agent_type: str
    max_tokens: int
    required_types: List[str]
    preferred_types: List[str]
    excluded_types: List[str]
    max_code_artifacts: int
    max_history_depth: int

PROFILES = {
    "PLANNER": ContextProfile(
        agent_type="PLANNER",
        max_tokens=8000,
        required_types=["user_input", "decision", "error"],
        preferred_types=["plan", "summary"],
        excluded_types=["code"],  # Planner doesn't need raw code
        max_code_artifacts=0,
        max_history_depth=10
    ),
    "CODER": ContextProfile(
        agent_type="CODER",
        max_tokens=12000,
        required_types=["plan", "code", "decision"],
        preferred_types=["fact", "error"],
        excluded_types=["summary"],
        max_code_artifacts=20,
        max_history_depth=5
    ),
    "EVALUATOR": ContextProfile(
        agent_type="EVALUATOR",
        max_tokens=6000,
        required_types=["code", "plan"],
        preferred_types=["error"],
        excluded_types=["user_input", "summary"],
        max_code_artifacts=10,
        max_history_depth=3
    )
}
```

### Compilation Algorithm

```python
def compile_context(artifacts: List[Artifact],
                    profile: ContextProfile) -> CompiledContext:
    # Step 1: Filter by type
    filtered = [a for a in artifacts
                if a.type in profile.required_types + profile.preferred_types
                and a.type not in profile.excluded_types]

    # Step 2: Resolve dependencies
    with_deps = resolve_dependencies(filtered, artifacts)

    # Step 3: Sort by priority and recency
    sorted_arts = sorted(with_deps,
                         key=lambda a: (a.priority, -age_seconds(a)),
                         reverse=True)

    # Step 4: Budget tokens
    selected = []
    token_count = 0
    code_count = 0

    for art in sorted_arts:
        art_tokens = count_tokens(art.content)

        if art.type == "code":
            if code_count >= profile.max_code_artifacts:
                continue
            code_count += 1

        if token_count + art_tokens > profile.max_tokens:
            # Try compression
            compressed = compress_artifact(art)
            art_tokens = count_tokens(compressed.content)
            if token_count + art_tokens > profile.max_tokens:
                continue
            art = compressed

        selected.append(art)
        token_count += art_tokens

    # Step 5: Render
    return render_context(selected, profile)
```

## Compression Strategies

### Summary Compression

Replace detailed artifacts with summaries:

```python
def compress_to_summary(artifacts: List[Artifact]) -> Artifact:
    # Group by type
    by_type = group_by(artifacts, key=lambda a: a.type)

    # Summarize each group
    summary_parts = []
    for type_name, type_arts in by_type.items():
        count = len(type_arts)
        if type_name == "code":
            files = set(a.metadata.get("file") for a in type_arts)
            summary_parts.append(f"Modified {count} code sections in {len(files)} files")
        elif type_name == "decision":
            decisions = [a.content[:50] for a in type_arts[:3]]
            summary_parts.append(f"Made {count} decisions: {', '.join(decisions)}...")
        # ... other types

    return Artifact(
        id=uuid4(),
        type="summary",
        content="\n".join(summary_parts),
        metadata={"summarized_count": len(artifacts)},
        priority=0.5
    )
```

### Code Compression

Reduce code to signatures:

```python
def compress_code(artifact: Artifact) -> Artifact:
    code = artifact.content
    language = artifact.metadata.get("language", "python")

    if language == "python":
        # Extract function/class signatures only
        compressed = extract_signatures(code)
    else:
        # Generic: first and last N lines
        lines = code.split("\n")
        if len(lines) > 20:
            compressed = "\n".join(lines[:5] + ["..."] + lines[-5:])
        else:
            compressed = code

    new_art = artifact.copy()
    new_art.content = compressed
    new_art.compressed = True
    return new_art
```

### Diff Compression

Store changes as diffs instead of full files:

```python
def compress_to_diff(before: str, after: str) -> str:
    diff = unified_diff(before.splitlines(), after.splitlines())
    return "\n".join(diff)
```

## Artifact Lifecycle

### Creation

```python
def create_artifact(type: str, content: str,
                    metadata: dict, agent: str) -> Artifact:
    return Artifact(
        id=uuid4(),
        type=type,
        content=content,
        metadata=metadata,
        references=[],
        created_at=now(),
        priority=default_priority(type),
        agent=agent,
        compressed=False
    )
```

### Expiration

```python
def check_expiration(artifact: Artifact) -> bool:
    if artifact.expires_at and now() > artifact.expires_at:
        return True

    # Age-based priority decay
    age_days = (now() - artifact.created_at).days
    if artifact.priority * (0.9 ** age_days) < 0.1:
        return True

    return False
```

### Eviction

```python
def evict_artifacts(store: ArtifactStore, max_size: int):
    artifacts = store.all()

    # Remove expired
    for art in artifacts:
        if check_expiration(art):
            store.delete(art.id)

    # If still over budget, remove lowest priority
    remaining = store.all()
    if len(remaining) > max_size:
        sorted_arts = sorted(remaining, key=lambda a: a.priority)
        to_remove = sorted_arts[:len(remaining) - max_size]
        for art in to_remove:
            store.delete(art.id)
```

## Storage

**Default path:** `~/.crazycode/artifacts/`

### Schema

```sql
CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSON,
    references JSON,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    priority REAL NOT NULL,
    agent TEXT NOT NULL,
    compressed INTEGER DEFAULT 0,
    session_id TEXT
);

CREATE INDEX idx_type ON artifacts(type);
CREATE INDEX idx_priority ON artifacts(priority);
CREATE INDEX idx_session ON artifacts(session_id);
CREATE INDEX idx_created ON artifacts(created_at);
```

## TUI Integration

### Artifact Inspector

```
/artifacts [filter]

Artifacts (47 total, 12,340 tokens)
──────────────────────────────────────────────
 ID      Type      Agent     Pri   Age    Tokens
──────────────────────────────────────────────
 art_047 code      CODER     0.9   2m     450
 art_046 decision  PLANNER   0.8   5m     120
 art_045 code      CODER     0.8   8m     380 [compressed]
 art_044 error     EVALUATOR 0.7   12m    200
 ...

[v]iew [d]elete [c]ompress [e]xport
```

### Context Preview

```
/context CODER

Compiled Context for CODER (8,240 / 12,000 tokens)
──────────────────────────────────────────────
Included:
  - 8 code artifacts (3,200 tokens)
  - 2 plan artifacts (800 tokens)
  - 3 decision artifacts (400 tokens)
  - 1 error artifact (200 tokens)
  - 4 fact artifacts (640 tokens)

Excluded (over budget):
  - 12 older code artifacts
  - 5 low-priority facts

[p]review full context
```

## Cross-Agent Sharing

### Artifact Handoff

```python
def handoff(from_agent: str, to_agent: str,
            artifacts: List[Artifact]) -> List[Artifact]:
    """Prepare artifacts from one agent for another."""
    to_profile = PROFILES[to_agent]

    # Filter to types the receiving agent wants
    relevant = [a for a in artifacts
                if a.type in to_profile.required_types + to_profile.preferred_types]

    # Mark as handoff for audit
    for art in relevant:
        art.metadata["handoff_from"] = from_agent

    return relevant
```

## Non-Goals

- No semantic embedding-based compression
- No automatic artifact type inference
- No cross-machine artifact sync
- No artifact versioning/history

## Success Criteria

- [ ] Context size remains stable over 100+ interactions
- [ ] Agent receives relevant context 95% of the time
- [ ] Compression reduces token count by 50%+ when needed
- [ ] User can inspect any artifact via TUI
- [ ] Context compilation completes in < 500ms
