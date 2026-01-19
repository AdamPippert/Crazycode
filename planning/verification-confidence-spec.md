# Verification & Confidence Specification

> Evaluator Pipeline with Autonomy Gating for CrazyCode

## Purpose

Verification & Confidence provides a multi-stage evaluation pipeline that assesses code quality, correctness, and safety before execution. The confidence score gates autonomy levels—high confidence enables auto-execution, low confidence requires user approval. This ensures CrazyCode operates safely while maximizing efficiency.

This subsystem is **transparent**, **configurable**, and **fail-safe**.

## Design Constraints

- Must complete evaluation in < 10 seconds for typical changes
- Must produce explainable confidence scores
- Must never allow execution without minimum verification
- Must support custom evaluation rules
- Must degrade gracefully if evaluators fail

## Core Concept

Verification treats every code change as **UNTRUSTED** until proven safe.

The pipeline:
1. Runs multiple independent evaluators
2. Aggregates results into a confidence score
3. Routes to appropriate autonomy level
4. Provides detailed feedback for failures

## Evaluator Pipeline

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────┐
│                    Generated Code                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Stage 1: Syntax Validation                  │
│         (parse, compile check, basic structure)          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Stage 2: Static Analysis                    │
│      (lint, type check, security scan, complexity)       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Stage 3: Semantic Validation                │
│     (intent match, coverage, behavioral correctness)     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Stage 4: Safety Checks                      │
│       (sandbox limits, resource bounds, side effects)    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               Confidence Aggregation                     │
└─────────────────────────────────────────────────────────┘
```

### Evaluator Types

| Evaluator | Stage | Description |
|-----------|-------|-------------|
| `syntax` | 1 | Language parser validation |
| `compile` | 1 | Compiler/interpreter check |
| `lint` | 2 | Style and pattern enforcement |
| `typecheck` | 2 | Static type verification |
| `security` | 2 | Vulnerability scanning |
| `complexity` | 2 | Cyclomatic complexity bounds |
| `intent` | 3 | Does code match task description |
| `coverage` | 3 | Test coverage analysis |
| `behavior` | 3 | Property-based validation |
| `sandbox` | 4 | Resource limit verification |
| `effects` | 4 | Side effect detection |
| `reversibility` | 4 | Can changes be undone |

## Evaluator Interface

### Base Evaluator

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class EvalResult:
    passed: bool
    score: float  # 0.0 to 1.0
    issues: List[Issue]
    metadata: dict

@dataclass
class Issue:
    severity: str  # "error", "warning", "info"
    message: str
    location: Optional[Location]
    fix_hint: Optional[str]

class Evaluator(ABC):
    name: str
    stage: int
    weight: float  # Contribution to final score

    @abstractmethod
    def evaluate(self, code: str, context: EvalContext) -> EvalResult:
        pass

    @abstractmethod
    def can_run(self, context: EvalContext) -> bool:
        """Check if evaluator applies to this code."""
        pass
```

### Built-in Evaluators

```python
class SyntaxEvaluator(Evaluator):
    name = "syntax"
    stage = 1
    weight = 1.0  # Must pass

    def evaluate(self, code: str, context: EvalContext) -> EvalResult:
        try:
            ast.parse(code)
            return EvalResult(passed=True, score=1.0, issues=[], metadata={})
        except SyntaxError as e:
            return EvalResult(
                passed=False,
                score=0.0,
                issues=[Issue(
                    severity="error",
                    message=str(e),
                    location=Location(line=e.lineno, col=e.offset),
                    fix_hint=None
                )],
                metadata={}
            )

class LintEvaluator(Evaluator):
    name = "lint"
    stage = 2
    weight = 0.3

    def evaluate(self, code: str, context: EvalContext) -> EvalResult:
        # Run ruff or equivalent
        result = run_linter(code, context.language)
        issues = [Issue(
            severity=issue["level"],
            message=issue["message"],
            location=Location(line=issue["line"]),
            fix_hint=issue.get("fix")
        ) for issue in result.issues]

        # Score based on issue count and severity
        error_count = sum(1 for i in issues if i.severity == "error")
        warning_count = sum(1 for i in issues if i.severity == "warning")

        if error_count > 0:
            score = 0.0
        elif warning_count > 5:
            score = 0.5
        elif warning_count > 0:
            score = 0.8
        else:
            score = 1.0

        return EvalResult(
            passed=error_count == 0,
            score=score,
            issues=issues,
            metadata={"error_count": error_count, "warning_count": warning_count}
        )
```

## Confidence Scoring

### Score Calculation

```python
def calculate_confidence(results: List[EvalResult]) -> float:
    if not results:
        return 0.0

    # Stage 1 must pass entirely
    stage1 = [r for r in results if r.evaluator.stage == 1]
    if not all(r.passed for r in stage1):
        return 0.0

    # Weighted average of other stages
    total_weight = sum(r.evaluator.weight for r in results)
    weighted_score = sum(r.score * r.evaluator.weight for r in results)

    return weighted_score / total_weight
```

### Score Interpretation

| Score Range | Interpretation |
|-------------|----------------|
| 0.95–1.00 | Excellent - all checks pass |
| 0.80–0.94 | Good - minor warnings only |
| 0.60–0.79 | Acceptable - some issues |
| 0.40–0.59 | Questionable - significant concerns |
| 0.00–0.39 | Poor - major issues detected |

## Autonomy Gating

### Autonomy Levels

| Level | Trigger | Behavior |
|-------|---------|----------|
| `auto` | confidence >= 0.9 | Execute immediately |
| `confirm` | 0.7 <= confidence < 0.9 | Show summary, proceed on Enter |
| `review` | 0.5 <= confidence < 0.7 | Show diff, require explicit approval |
| `manual` | confidence < 0.5 | Block execution, show all issues |

### Gating Logic

```python
def gate_execution(confidence: float, results: List[EvalResult]) -> Action:
    # Check for blocking issues regardless of score
    has_security_issue = any(
        r.evaluator.name == "security" and not r.passed
        for r in results
    )
    if has_security_issue:
        return Action.BLOCK

    # Confidence-based gating
    if confidence >= 0.9:
        return Action.AUTO_EXECUTE
    elif confidence >= 0.7:
        return Action.CONFIRM
    elif confidence >= 0.5:
        return Action.REVIEW
    else:
        return Action.BLOCK
```

### User Override

Users can configure thresholds:

```toml
# ~/.crazycode/config.toml

[verification]
auto_threshold = 0.95     # Higher = more cautious
confirm_threshold = 0.80
review_threshold = 0.60

[verification.overrides]
# Always require review for certain patterns
patterns = ["migrations/*", "*.sql", "deploy/*"]
```

## TUI Integration

### Confidence Display

```
[eval] create-api-endpoint
  ├─ syntax    ✓ 1.00
  ├─ lint      ✓ 0.95  (2 warnings)
  ├─ typecheck ✓ 1.00
  ├─ security  ✓ 1.00
  └─ intent    ✓ 0.88

  Confidence: 0.91 [████████░░] AUTO

Executing in sandbox...
```

### Issue Display

```
[eval] create-api-endpoint
  ├─ syntax    ✓ 1.00
  ├─ lint      ✗ 0.40
  │   └─ error: unused import 'os' (line 3)
  │   └─ error: undefined name 'request' (line 15)
  │   └─ warning: line too long (line 22)
  ├─ typecheck ✗ 0.00
  │   └─ error: incompatible return type (line 18)
  ├─ security  ✓ 1.00
  └─ intent    ? skipped (blocked by earlier failures)

  Confidence: 0.28 [██░░░░░░░░] BLOCKED

Fix 3 errors before execution can proceed.
```

## Pipeline Execution

### Run Order

```python
def run_pipeline(code: str, context: EvalContext) -> PipelineResult:
    results = []

    for stage in [1, 2, 3, 4]:
        stage_evaluators = [e for e in evaluators if e.stage == stage]
        stage_results = []

        for evaluator in stage_evaluators:
            if not evaluator.can_run(context):
                continue

            result = evaluator.evaluate(code, context)
            result.evaluator = evaluator
            stage_results.append(result)

        results.extend(stage_results)

        # Early exit if stage 1 fails
        if stage == 1 and not all(r.passed for r in stage_results):
            break

        # Early exit if too many failures
        failed_count = sum(1 for r in results if not r.passed)
        if failed_count > 3:
            break

    confidence = calculate_confidence(results)
    action = gate_execution(confidence, results)

    return PipelineResult(
        results=results,
        confidence=confidence,
        action=action,
        issues=collect_issues(results)
    )
```

### Parallel Execution

Stage 2 evaluators can run in parallel:

```python
async def run_stage_parallel(evaluators: List[Evaluator],
                              code: str,
                              context: EvalContext) -> List[EvalResult]:
    tasks = [
        asyncio.create_task(e.evaluate(code, context))
        for e in evaluators
        if e.can_run(context)
    ]
    return await asyncio.gather(*tasks)
```

## Custom Evaluators

### Registration

```python
# ~/.crazycode/evaluators/custom_security.py

from crazycode.verification import Evaluator, EvalResult

class CustomSecurityEvaluator(Evaluator):
    name = "custom_security"
    stage = 2
    weight = 0.5

    def can_run(self, context):
        return context.language in ("python", "javascript")

    def evaluate(self, code, context):
        # Custom security logic
        issues = self.scan_for_issues(code)
        return EvalResult(
            passed=len(issues) == 0,
            score=1.0 if not issues else 0.0,
            issues=issues,
            metadata={}
        )

# Register in config.toml
# [verification.custom_evaluators]
# paths = ["~/.crazycode/evaluators/"]
```

## Non-Goals

- No ML-based code quality prediction
- No automatic issue fixing
- No cross-project evaluation sharing
- No real-time continuous evaluation

## Success Criteria

- [ ] Pipeline completes in < 10 seconds for typical code
- [ ] Zero false negatives on security issues
- [ ] Users understand why code was blocked
- [ ] Confidence scores correlate with actual success rate
- [ ] Custom evaluators integrate seamlessly
