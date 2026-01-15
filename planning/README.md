# CrazyCode Planning Documents

> Implementation plans for next-generation TUI agent innovations

## Overview

CrazyCode is evolving from a reactive assistant into a **persistent, self-improving coding operator**. This directory contains specifications for the key subsystems that will enable this transformation.

## Architecture

```
┌──────────────────────────────────────────┐
│            CrazyCode TUI                 │
│  (commands, progress trees, diffs, logs) │
└──────────────────────────────────────────┘
                    │
┌──────────────────────────────────────────┐
│     Orchestration & Routing Layer        │
│   (Puppeteer + Adaptive Coordination)    │
└──────────────────────────────────────────┘
                    │
┌──────────────────────────────────────────┐
│     Planning & Decomposition Layer       │
│  (Hierarchical Tasks + AgentReuse Cache) │
└──────────────────────────────────────────┘
                    │
┌──────────────────────────────────────────┐
│        Memory & Context Layer            │
│    (Evo-Memory + MAGMA + ADK Artifacts)  │
└──────────────────────────────────────────┘
                    │
┌──────────────────────────────────────────┐
│     Execution & Verification Layer       │
│  (Sandboxes, Evaluators, Confidence Gate)│
└──────────────────────────────────────────┘
```

## Specifications

### Completed

| Spec | File | Status |
|------|------|--------|
| Evo-Memory | [evo-memory-spec.md](./evo-memory-spec.md) | ✅ Ready |
| Orchestration Loop | [orchestration-loop-spec.md](./orchestration-loop-spec.md) | ✅ Ready |
| Ralph Mode | [ralph-mode-spec.md](./ralph-mode-spec.md) | ✅ Ready |

### Planned

| Spec | Description | Priority |
|------|-------------|----------|
| MAGMA | Multi-Graph Memory Architecture | High |
| AgentReuse | Semantic Plan Caching | High |
| Adaptive Coordination | Parallel agents, upstream revision, runtime rerouting | Medium |
| Hierarchical Tasks | Task trees with pause/resume/override | Medium |
| Verification & Confidence | Evaluator pipeline with autonomy gating | High |
| Context Engineering (ADK) | Artifact system and context compiler | High |

## Execution Roadmap

### Phase 1 (0–30 days): Foundations
- [ ] Artifact system (ADK)
- [ ] Hierarchical task tree
- [ ] Basic verification agent
- [ ] Local sandbox hardening

### Phase 2 (30–60 days): Intelligence Reuse
- [ ] AgentReuse plan cache
- [ ] Evo-Memory v1
- [ ] Confidence scoring

### Phase 3 (60–90 days): Orchestration
- [ ] Puppeteer orchestrator
- [ ] Parallel coordination
- [ ] MAGMA graph backend

### Phase 4 (90+ days): Learning & Autonomy
- [ ] Reinforcement signals
- [ ] Routing optimization
- [ ] Progressive autonomy modes

## Success Metrics

| Metric | Target |
|--------|--------|
| Repeated task latency | ↓ 70% |
| User interruptions | ↓ 50% |
| Failed executions | ↓ 40% |
| Context token size | Stable over weeks |
| Plan reuse rate | > 60% |

## Design Principles

1. **Local-first**: Everything works offline
2. **Auditable**: No hidden agent actions
3. **Deterministic**: Predictable behavior by default
4. **User control**: Oversight preserved at all times
5. **Terminal-native**: No GUI dependencies
