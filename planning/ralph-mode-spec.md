# Ralph Mode Specification

> Deep planning and iterative implementation using the Geoffrey Huntley Algorithm

**Status**: Ready
**Version**: 1.0
**Author**: CrazyCode Team

---

## Abstract

Ralph Mode is a specialized agent mode that enforces disciplined software development through deep planning and iterative implementation. It provides two entry paths: **Guided Planning Conversation** for fleshing out ideas, and **Deep Research Mode** for understanding topics before planning. Both paths culminate in execution via the **Geoffrey Huntley Algorithm** (Huntley Loop).

## Goals

1. **Reduce implementation failures** by ensuring complete understanding before coding
2. **Improve requirements quality** through structured discovery conversations
3. **Enable research-driven development** for unfamiliar domains
4. **Enforce verification discipline** through mandatory test-verify-proceed loops
5. **Create accurate software** by continuing iteration until correctness is achieved

## Non-Goals

- Quick prototyping (use standard build mode)
- Trivial changes (overhead not justified)
- Real-time/interactive development (too slow)
- Replacing human architectural decisions (augments, not replaces)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     RALPH MODE ENTRY                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│  GUIDED PLANNING    │         │   DEEP RESEARCH     │
│   CONVERSATION      │         │      MODE           │
├─────────────────────┤         ├─────────────────────┤
│ 1. Discovery        │         │ 1. Scope Definition │
│ 2. Crystallization  │         │ 2. Info Gathering   │
│ 3. Architecture     │         │ 3. Synthesis        │
│ 4. Detailed Plan    │         │ 4. Plan Building    │
└─────────┬───────────┘         └─────────┬───────────┘
          │                               │
          └───────────────┬───────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   IMPLEMENTATION PHASE                       │
│                  (The Huntley Loop)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐                                            │
│   │ SELECT TASK │◄──────────────────────────────┐            │
│   └──────┬──────┘                               │            │
│          │                                      │            │
│          ▼                                      │            │
│   ┌─────────────┐                               │            │
│   │ UNDERSTAND  │                               │            │
│   └──────┬──────┘                               │            │
│          │                                      │            │
│          ▼                                      │            │
│   ┌─────────────┐                               │            │
│   │    PLAN     │                               │            │
│   └──────┬──────┘                               │            │
│          │                                      │            │
│          ▼                                      │            │
│   ┌─────────────┐                               │            │
│   │  IMPLEMENT  │                               │            │
│   └──────┬──────┘                               │            │
│          │                                      │            │
│          ▼                                      │            │
│   ┌─────────────┐                               │            │
│   │   VERIFY    │                               │            │
│   └──────┬──────┘                               │            │
│          │                                      │            │
│          ▼                                      │            │
│   ┌─────────────┐    FAIL    ┌─────────────┐    │            │
│   │  EVALUATE   ├───────────►│  DIAGNOSE   │────┘            │
│   └──────┬──────┘            └─────────────┘                 │
│          │ PASS                                              │
│          ▼                                                   │
│   ┌─────────────┐                                            │
│   │  COMPLETE?  │──── NO ────► (loop back to SELECT)         │
│   └──────┬──────┘                                            │
│          │ YES                                               │
│          ▼                                                   │
│       [DONE]                                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## The Geoffrey Huntley Algorithm

### Origin and Philosophy

The Geoffrey Huntley Algorithm is a first-principles approach to software development that prioritizes understanding and verification over speed. Named after the methodology's core principles:

1. **Never write code you don't understand**
2. **Plan extensively before implementing**
3. **Make small, verifiable changes**
4. **Test after every change**
5. **Iterate until correct**

### Core Loop Definition

```
HUNTLEY_LOOP:
  while tasks_remaining:
    task = select_next_task()

    # UNDERSTAND
    context = read_relevant_code()
    touchpoints = identify_affected_areas()
    current_behavior = document_existing_behavior()

    # PLAN
    changes = determine_exact_changes()
    verification = define_verification_method()
    risks = predict_potential_issues()

    # IMPLEMENT
    apply_minimal_focused_change()

    # VERIFY
    result = run_verification()

    # EVALUATE
    if result.success:
      mark_task_complete()
    else:
      diagnose_failure()
      adjust_plan()
      retry_implementation()
```

### Key Properties

| Property | Description |
|----------|-------------|
| **Atomicity** | Each change is the smallest possible logical unit |
| **Traceability** | Every action is documented with reasoning |
| **Reversibility** | Changes can be undone if verification fails |
| **Completeness** | Loop continues until all tasks pass verification |

---

## Entry Mode A: Guided Planning Conversation

### Phase 1: Discovery

Ask systematic questions to understand the problem space:

**Problem Domain**
- What is the core problem being solved?
- Why does this problem exist?
- What happens if it's not solved?

**Stakeholders**
- Who are the users?
- Who are the other stakeholders?
- What are their priorities?

**Success Criteria**
- What does success look like?
- How will we measure it?
- What's the minimum viable outcome?

**Constraints**
- What are the time constraints?
- What technologies must be used?
- What scale must it support?
- What existing systems must it integrate with?

**Edge Cases**
- What could go wrong?
- What are the unusual scenarios?
- How should errors be handled?

### Phase 2: Requirements Crystallization

Transform discoveries into formal requirements:

```markdown
## Functional Requirements

### FR-001: [Title]
- **Description**: [What the system must do]
- **Priority**: [Must/Should/Could]
- **Acceptance Criteria**: [How to verify]

### FR-002: [Title]
...

## Non-Functional Requirements

### NFR-001: [Title]
- **Category**: [Performance/Security/Usability/etc.]
- **Description**: [The constraint or quality attribute]
- **Metric**: [How to measure]
- **Target**: [Acceptable threshold]
```

### Phase 3: Architecture Design

Propose and validate architecture:

1. **Component Identification** - What are the major pieces?
2. **Interface Definition** - How do components communicate?
3. **Data Flow Mapping** - How does data move through the system?
4. **Technology Selection** - What tools/frameworks/languages?
5. **Trade-off Analysis** - What are we optimizing for?

### Phase 4: Detailed Planning

Break architecture into implementable tasks:

```markdown
## Task Breakdown

### Task 1: [Title]
- **Description**: [What to do]
- **Dependencies**: [What must be done first]
- **Inputs**: [What's needed]
- **Outputs**: [What's produced]
- **Verification**: [How to confirm success]
- **Estimated Complexity**: [Low/Medium/High]

### Task 2: [Title]
...
```

---

## Entry Mode B: Deep Research

### Phase 1: Scope Definition

Establish research boundaries:

- **Topic**: What needs to be understood?
- **Depth**: Surface understanding or expert knowledge?
- **Breadth**: Focused or comprehensive?
- **Sources**: What authorities should be consulted?
- **Time Budget**: How much research is appropriate?

### Phase 2: Information Gathering

Systematic knowledge acquisition:

1. **Primary Sources**
   - Official documentation
   - Specifications and RFCs
   - Academic papers

2. **Secondary Sources**
   - Tutorial and guides
   - Blog posts and articles
   - Community discussions

3. **Practical Sources**
   - Open source implementations
   - Example code
   - Test suites

4. **Experiential Sources**
   - Best practices
   - Anti-patterns
   - War stories

### Phase 3: Knowledge Synthesis

Organize findings:

```markdown
## Research Summary: [Topic]

### Key Concepts
- **Concept 1**: [Explanation]
- **Concept 2**: [Explanation]

### Critical Insights
1. [Insight with source]
2. [Insight with source]

### Trade-offs
| Option | Pros | Cons |
|--------|------|------|

### Best Practices
- [Practice 1]
- [Practice 2]

### Common Pitfalls
- [Pitfall 1]
- [Pitfall 2]

### Recommendations
[Specific recommendations for the user's context]
```

### Phase 4: Plan Construction

Apply research to create implementation plan:

1. Map research findings to user's specific requirements
2. Select appropriate approaches based on trade-off analysis
3. Structure tasks based on discovered best practices
4. Include references to research sources
5. Transition to implementation via Huntley Loop

---

## Implementation Behavior

### Before Any Change

1. Announce the task being attempted
2. Show files that will be read/modified
3. Explain the planned change
4. State the verification method

### During Changes

1. Make minimal, atomic edits
2. Explain each edit's purpose
3. Keep track of modified files
4. Note any unexpected discoveries

### After Each Change

1. Run verification (tests, build, manual check)
2. Report results honestly
3. If failed: diagnose, plan fix, retry
4. If passed: mark complete, move to next task

### When Blocked

1. Clearly state the blocker
2. Explain what was attempted
3. Propose alternatives
4. Escalate to user if needed

---

## Confidence and Verification

### Confidence Scoring

Each task completion includes confidence assessment:

| Level | Score | Meaning |
|-------|-------|---------|
| **High** | 0.9-1.0 | Verified with tests, confident in correctness |
| **Medium** | 0.7-0.9 | Manually verified, likely correct |
| **Low** | 0.5-0.7 | Basic check done, some uncertainty |
| **Uncertain** | <0.5 | Unable to verify, user review needed |

### Verification Methods

| Method | When to Use |
|--------|-------------|
| **Unit Tests** | Isolated logic changes |
| **Integration Tests** | Multi-component changes |
| **Build Check** | Syntax/compilation validation |
| **Type Check** | Type-related changes |
| **Manual Test** | UI/UX or complex flows |
| **Code Review** | Architectural changes |

---

## Integration with CrazyCode

### Agent Configuration

```yaml
# .opencode/agent/ralph.md
---
description: Deep planning and iterative implementation
color: "#8E44AD"
mode: primary
model: anthropic/claude-opus-4-5-20251101
temperature: 0.3
tools:
  write: true
  edit: true
  bash: true
  read: true
  websearch: true
  webfetch: true
  todowrite: true
permission:
  bash: ask
  edit: ask
  write: ask
---
```

### Tool Usage

Ralph Mode uses tools strategically:

| Phase | Primary Tools |
|-------|---------------|
| Discovery | Conversation, Read, Grep, Glob |
| Research | WebSearch, WebFetch, Read |
| Planning | TodoWrite, Conversation |
| Implementation | Edit, Write, Bash |
| Verification | Bash (tests), Read (review) |

### Permission Model

Ralph Mode requests explicit permission for:
- All file modifications (Edit, Write)
- All bash commands
- Any destructive operations

This ensures user oversight during implementation.

---

## Example Session

```
USER: I want to add caching to our API

RALPH: Welcome to Ralph Mode. Let me help you plan this properly.

First, some discovery questions:

1. What API endpoints need caching?
2. What's the current response time you're seeing?
3. What cache invalidation strategy do you need?
4. Any existing caching infrastructure?
5. What's the expected cache hit rate target?

USER: All GET endpoints. Currently 200ms avg. Need TTL-based
invalidation. We use Redis. Target 80% hit rate.

RALPH: Great. Let me crystallize the requirements:

## Requirements Summary
- **Scope**: All GET endpoints
- **Current State**: 200ms average response
- **Cache Backend**: Redis (existing)
- **Invalidation**: TTL-based
- **Target**: 80% cache hit rate

Before proceeding, I'd like to understand:
1. What's your desired TTL duration?
2. Should cache keys include user identity?
3. How should cache misses be handled?

[... discovery continues ...]

RALPH: Based on our discussion, here's the implementation plan:

## Implementation Plan

### Task 1: Add cache middleware
- Create Redis cache middleware
- Verification: Unit tests pass

### Task 2: Implement cache key generation
- Hash endpoint + query params
- Verification: Key collision tests

### Task 3: Add TTL configuration
- Configurable per-endpoint TTL
- Verification: TTL expiry tests

### Task 4: Integrate with existing endpoints
- Wire middleware to all GET routes
- Verification: Integration tests

Shall I begin implementation with Task 1?

USER: Yes, proceed.

RALPH: Starting Huntley Loop for Task 1...

**UNDERSTAND**: Reading current middleware structure...
[reads files]

**PLAN**: Will create cache.ts middleware with:
- Redis connection handling
- Cache check before route handler
- Cache write after successful response

**IMPLEMENT**: Creating cache middleware...
[creates file]

**VERIFY**: Running tests...
[runs tests]

**RESULT**: 4/4 tests passing. Task 1 complete.
Confidence: HIGH (0.95)

Proceeding to Task 2...
```

---

## Metrics and Success Criteria

### Mode Effectiveness

| Metric | Target |
|--------|--------|
| Planning phase completion | 100% before implementation |
| Task verification rate | 100% of tasks verified |
| Implementation success rate | >90% first attempt |
| Rework required | <10% of tasks |

### User Satisfaction

| Metric | Target |
|--------|--------|
| Understanding clarity | User confirms understanding |
| Plan approval rate | >95% plans approved |
| Outcome accuracy | Software matches requirements |

---

## Future Enhancements

1. **Plan Templates** - Pre-built plans for common patterns
2. **Research Caching** - Store research for reuse
3. **Confidence Learning** - Improve verification based on outcomes
4. **Multi-Agent Delegation** - Delegate subtasks to specialized agents
5. **Plan Versioning** - Track plan evolution over time

---

## References

- [Orchestration Loop Spec](./orchestration-loop-spec.md)
- [Evo-Memory Spec](./evo-memory-spec.md)
- Geoffrey Huntley Algorithm (first principles methodology)
