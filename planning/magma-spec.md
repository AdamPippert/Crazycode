# MAGMA Specification

> Multi-Graph Memory Architecture for CrazyCode

## Purpose

MAGMA provides a unified graph-based memory substrate that connects experiences, entities, relationships, and temporal context. Unlike flat experience storage (Evo-Memory), MAGMA enables rich traversal, causal reasoning, and emergent pattern discovery across the agent's operational history.

This subsystem is **local-first**, **queryable**, and **incrementally computable**.

## Design Constraints

- Must work without network access
- Must support incremental graph updates without full recomputation
- Must enable sub-second traversal for common queries
- Must be auditable and exportable
- Must not grow unbounded (eviction policies required)

## Core Concept

MAGMA stores **KNOWLEDGE AS GRAPHS**, not records.

The system maintains multiple interconnected graph layers:

1. **Entity Graph** - Files, functions, classes, modules, projects
2. **Experience Graph** - Tasks, actions, outcomes (from Evo-Memory)
3. **Causal Graph** - Action → Effect relationships
4. **Temporal Graph** - Session sequences and time-based patterns
5. **Semantic Graph** - Concept clusters and similarity links

## Graph Model

### Node Types

| Type         | Description        | Example                                        |
| ------------ | ------------------ | ---------------------------------------------- |
| `Entity`     | Code artifact      | `file:src/api.py`, `func:parse_request`        |
| `Experience` | Completed task     | `exp:debug-import-error-a8f1c2`                |
| `Action`     | Discrete operation | `action:add-file`, `action:run-test`           |
| `Concept`    | Abstract pattern   | `concept:error-handling`, `concept:api-design` |
| `Session`    | Work session       | `session:2026-01-10-18:00`                     |

### Edge Types

| Type          | Connects                | Meaning               |
| ------------- | ----------------------- | --------------------- |
| `contains`    | Entity → Entity         | Structural hierarchy  |
| `modifies`    | Action → Entity         | Mutation relationship |
| `causes`      | Action → Action         | Causal chain          |
| `similar_to`  | Experience → Experience | Semantic similarity   |
| `precedes`    | Session → Session       | Temporal ordering     |
| `tagged_with` | Experience → Concept    | Classification        |
| `resolved_by` | Entity → Experience     | Problem-solution link |

### Edge Properties

| Property     | Type   | Description                        |
| ------------ | ------ | ---------------------------------- |
| `weight`     | float  | Relationship strength (0.0–1.0)    |
| `timestamp`  | string | When relationship was created      |
| `confidence` | float  | Certainty of the relationship      |
| `source`     | enum   | `inferred` \| `explicit` \| `user` |

## Storage

**Default path:** `~/.crazycode/graph/`

### Recommended Backends

1. **SQLite with JSON1** (v1 preferred)
2. **DuckDB** (analytical queries)
3. **Embedded graph DB** (future: kuzu, memgraph)

### Schema (SQLite)

```sql
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data JSON NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE edges (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    confidence REAL DEFAULT 1.0,
    source TEXT DEFAULT 'inferred',
    created_at TEXT NOT NULL,
    PRIMARY KEY (source_id, target_id, type)
);

CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
CREATE INDEX idx_edges_type ON edges(type);
```

## Graph Construction

### Triggers

| Event                 | Graph Update                             |
| --------------------- | ---------------------------------------- |
| File created/modified | Add/update Entity node, `modifies` edges |
| Experience stored     | Add Experience node, link to Entities    |
| Task completed        | Add causal edges from plan actions       |
| Session end           | Finalize Session node, temporal edges    |
| Similarity detected   | Add `similar_to` edges (batch job)       |

### Entity Extraction

From code artifacts:

- Parse AST to extract functions, classes, imports
- Create `contains` edges for structural hierarchy
- Create `imports` edges for dependencies

### Causal Inference

From execution traces:

- If action A immediately precedes action B in plan → `causes` edge
- If action A modifies file F and action B reads F → `causes` edge
- Weight by temporal proximity and success rate

## Query Interface

### Query Language (v1)

Simple path-based queries:

```
# Find experiences that modified a file
MATCH (e:Experience)-[:modifies]->(f:Entity {path: "src/api.py"})
RETURN e

# Find causal chain for an error
MATCH path = (a:Action)-[:causes*1..5]->(b:Action {type: "error"})
RETURN path

# Find similar experiences
MATCH (e1:Experience {id: $id})-[:similar_to]->(e2:Experience)
WHERE e2.outcome = "success"
RETURN e2 ORDER BY weight DESC LIMIT 5
```

### API Methods

```python
class MAGMAGraph:
    def add_node(self, id: str, type: str, data: dict) -> None
    def add_edge(self, source: str, target: str, type: str, **props) -> None
    def query(self, pattern: str) -> List[dict]
    def neighbors(self, node_id: str, edge_type: str = None) -> List[str]
    def path(self, start: str, end: str, max_depth: int = 5) -> List[str]
    def subgraph(self, center: str, radius: int = 2) -> Graph
```

## Integration with Evo-Memory

MAGMA extends Evo-Memory, not replaces it.

```
┌─────────────────────────────────────────┐
│              Evo-Memory                 │
│  (flat experience records, fast lookup) │
└─────────────────────────────────────────┘
                    │
                    ▼ sync
┌─────────────────────────────────────────┐
│               MAGMA                     │
│   (graph relationships, traversal)      │
└─────────────────────────────────────────┘
```

- New experiences in Evo-Memory trigger MAGMA node creation
- MAGMA adds relationship edges that Evo-Memory cannot express
- Queries can span both: Evo-Memory for fast retrieval, MAGMA for context

## Memory Management

### Eviction Policy

- **LRU by access**: Nodes not traversed in 90 days marked for eviction
- **Weak edge pruning**: Edges with weight < 0.1 after decay removed
- **Compaction**: Merge similar concepts, deduplicate paths

### Weight Decay

Edge weights decay over time unless reinforced:

```python
new_weight = current_weight * (0.99 ** days_since_access)
```

Reinforcement:

- Traversal in query: +0.1
- Successful experience using edge: +0.2
- User explicit bookmark: +0.5

## Planner Integration

MAGMA provides context for planning:

```python
def plan_with_context(task, evo_memory, magma):
    # Get similar experiences from Evo-Memory
    similar = evo_memory.retrieve(task.signature)

    # Enrich with MAGMA context
    for exp in similar:
        exp.causal_chain = magma.path(exp.first_action, exp.last_action)
        exp.affected_entities = magma.neighbors(exp.id, "modifies")
        exp.related_concepts = magma.neighbors(exp.id, "tagged_with")

    return planner.generate(task, similar)
```

## Non-Goals

- No distributed graph (single-machine only)
- No real-time streaming updates
- No ML-based embeddings in v1
- No cross-project graph sharing

## Success Criteria

- [ ] Causal chains retrievable in < 100ms
- [ ] Entity relationships accurate to AST structure
- [ ] Graph size stabilizes with eviction
- [ ] Planner uses graph context for 50%+ of plans
- [ ] User can visualize subgraphs on demand
