# Harness Feature Analysis: Opportunities for Crazycode

This document analyzes features from Claude Code, Codex, and Gemini CLI that could enhance Crazycode, based on the [harness-howto](https://github.com/ParkerRex/harness-howto) repository.

## Executive Summary

After analyzing the architecture and features of Claude Code Open, OpenAI Codex, and Google Gemini CLI, several unique capabilities emerge that Crazycode could benefit from adopting. The key areas for improvement include:

1. **Advanced Context Management** - More sophisticated compaction triggers and strategies
2. **Enhanced Safety Mechanisms** - Sandboxing, loop detection, and failure recovery
3. **Observability & Telemetry** - Better monitoring and debugging capabilities
4. **Structured Task Management** - UI-renderable task checklists with events
5. **Policy Engine Improvements** - More sophisticated tool gating and confirmation flows

---

## Feature Comparison Matrix

| Feature | Crazycode | Claude Code | Codex | Gemini CLI |
|---------|-----------|-------------|-------|------------|
| **Context Compaction** | Basic | Multi-stage pipeline | Remote/inline | Hook-integrated |
| **Sandboxing** | Partial | Full sandbox | Rules engine | Seatbelt/Docker |
| **Loop Detection** | No | No | No | Yes |
| **Tool Checkpoints** | No | No | No | Yes |
| **Git Snapshots** | Basic (patch) | No | No | Yes |
| **Structured Events** | No | No | Yes | No |
| **Session Memory** | No | Yes (boundary UUID) | No | No |
| **Pre-compaction Hooks** | No | No | No | Yes |
| **Policy Engine** | Permission system | Permission manager | ToolRouter | Policy + Confirmation Bus |
| **Observability** | Basic | Telemetry + debug logs | JSONL logs | Full telemetry |
| **Model-per-Skill** | Yes | Yes | Yes (ModelInfo) | No |
| **Quota Fallback** | No | No | No | Yes |

---

## Detailed Feature Gap Analysis

### 1. Context Management Enhancements

#### 1.1 Multi-Stage Compaction Pipeline (from Claude Code)

**What Claude Code does:**
```
Stage 1: Microcompaction → Remove older persisted tool outputs
Stage 2: Conversation Summary → Replace historical messages with summary
Stage 3: Session Memory → Write organized memory with boundary UUID
```

**Gap in Crazycode:**
Crazycode has basic message compaction but lacks the sophisticated three-stage pipeline. The session memory feature with boundary UUIDs allows Claude Code to maintain organized context across sessions.

**Recommendation:**
Implement a multi-stage compaction system in `/packages/opencode/src/session/` that:
- First removes old tool outputs (microcompaction)
- Then summarizes conversation history
- Finally writes session memory with unique identifiers for context boundaries

#### 1.2 Pre-Compaction Hooks (from Gemini CLI)

**What Gemini CLI does:**
```typescript
// HookSystem executes pre-compression hooks before condensation
hookSystem.executePreCompactionHooks(context);
```

**Gap in Crazycode:**
No ability for plugins or users to customize what happens before compaction. This could be valuable for preserving critical context.

**Recommendation:**
Add `preCompaction` and `postCompaction` hooks to the plugin system to allow custom logic during context management.

#### 1.3 Configurable Compression Thresholds (from Gemini CLI)

**What Gemini CLI does:**
- **Trigger**: 50% of token limit (`DEFAULT_COMPRESSION_TOKEN_THRESHOLD`)
- **Retention**: Preserve newest 30% of history (`COMPRESSION_PRESERVE_THRESHOLD`)

**Gap in Crazycode:**
Thresholds appear to be hardcoded. User-configurable thresholds would provide more control.

**Recommendation:**
Add to `opencode.jsonc`:
```jsonc
{
  "experimental": {
    "compressionTokenThreshold": 0.5,
    "compressionPreserveThreshold": 0.3
  }
}
```

---

### 2. Safety & Failure Handling

#### 2.1 Loop Detection Service (from Gemini CLI)

**What Gemini CLI does:**
```typescript
// LoopDetectionService monitors for circular execution patterns
loopDetector.on(GeminiEventType.LoopDetected, (event) => {
  // Broadcast warning and potentially halt execution
});
```

**Gap in Crazycode:**
No mechanism to detect when the agent enters an infinite loop (e.g., repeatedly trying the same failed operation).

**Recommendation:**
Implement a `LoopDetectionService` in `/packages/opencode/src/session/` that:
- Tracks recent tool calls and their results
- Detects patterns of repeated failures
- Emits events when loops are detected
- Can auto-halt or prompt user intervention

#### 2.2 Enhanced Sandboxing (from Gemini CLI)

**What Gemini CLI does:**
```bash
# macOS Seatbelt sandboxing
gemini --sandbox

# Container-based isolation
GEMINI_SANDBOX=docker gemini
```

**Gap in Crazycode:**
Crazycode has permission-based controls but lacks true OS-level sandboxing. This is critical for enterprise environments.

**Recommendation:**
Add optional sandboxing support:
- macOS: Use `sandbox-exec` with custom profiles
- Linux: Use `firejail` or container isolation
- Cross-platform: Support Docker/Podman containerization

#### 2.3 Tool Checkpoints (from Gemini CLI)

**What Gemini CLI does:**
Maintains tool checkpoints alongside git snapshots, enabling recovery from failed operations.

**Gap in Crazycode:**
While Crazycode has `SnapshotPart` in messages, it lacks a formal checkpoint system for tool execution recovery.

**Recommendation:**
Implement tool execution checkpoints that:
- Save state before risky operations
- Enable rollback to last successful checkpoint
- Integrate with git for file-level recovery

#### 2.4 Quota Fallback Handler (from Gemini CLI)

**What Gemini CLI does:**
```typescript
// Adaptive recovery when quota limits are reached
quotaHandler.onQuotaExceeded(() => {
  // Switch to fallback model or pause execution
});
```

**Gap in Crazycode:**
No automatic fallback when rate limits or quota are exceeded. The agent simply fails.

**Recommendation:**
Implement a fallback strategy system:
- Define primary and fallback models per provider
- Auto-switch when quota exceeded
- Queue requests during rate limiting
- Notify user of degraded mode

---

### 3. Structured Events & Task Management

#### 3.1 UI-Renderable Task Events (from Codex)

**What Codex does:**
```typescript
// Plan/todos tool emits structured events
{
  type: "plan_update",
  todos: [
    { id: 1, content: "Fix bug", status: "completed" },
    { id: 2, content: "Write tests", status: "in_progress" }
  ]
}
```

**Gap in Crazycode:**
TodoWrite exists but doesn't emit structured events that UIs can render as interactive checklists. The todo system is primarily for agent tracking, not UI interaction.

**Recommendation:**
Enhance the todo system to emit bus events that:
- Can be rendered as interactive checklists in TUI/desktop/web
- Allow users to mark items complete manually
- Sync state bidirectionally between agent and UI

#### 3.2 Canonical Event Shape (from Codex)

**What Codex does:**
```typescript
// ResponseItem is the canonical transcript shape
interface ResponseItem {
  type: "message" | "tool_call" | "ui_event";
  // Unified structure for all interaction types
}
```

**Gap in Crazycode:**
Messages have multiple part types (TextPart, PatchPart, etc.) but no unified event shape for UI consumption.

**Recommendation:**
Consider adding a canonical event layer that wraps all message parts for consistent UI handling across desktop, web, and console interfaces.

---

### 4. Tool System Enhancements

#### 4.1 Tool Execution Policy Engine (from Gemini CLI)

**What Gemini CLI does:**
```
Tool Call → Policy Engine → Confirmation Bus → Approval → Execution
                ↓
         [Deny | Require Confirmation | Auto-Allow]
```

**Gap in Crazycode:**
Permission system is binary (allow/deny/ask). Gemini CLI's approach includes a confirmation bus that manages user interactions more elegantly.

**Recommendation:**
Add a `ConfirmationBus` that:
- Queues pending confirmations
- Allows batch approval of similar operations
- Provides better UX for high-frequency tool calls

#### 4.2 Tool State Machine (from Gemini CLI)

**What Gemini CLI does:**
Models tool call lifecycle through explicit states: `pending → validating → approved → executing → completed/failed`

**Gap in Crazycode:**
Tool execution is more procedural, lacking explicit state tracking.

**Recommendation:**
Implement a state machine for tool execution that:
- Provides better debugging
- Enables pause/resume of tool execution
- Supports retry with different parameters

#### 4.3 Parallel Tool Execution with Gating (from Codex)

**What Codex does:**
```rust
// tools/parallel.rs - Execute tools in parallel with gating
parallel_execute(tool_calls, gating_config);
```

**Gap in Crazycode:**
Tools are executed sequentially or the parallelism is limited. Codex has explicit parallel execution with gating support.

**Recommendation:**
Add explicit parallel tool execution in tool registry with:
- Configurable parallelism limits
- Dependency-aware gating
- Proper error aggregation

---

### 5. Observability & Debugging

#### 5.1 Comprehensive Telemetry (from Claude Code & Gemini CLI)

**What they do:**
- Session starts/ends
- Tool invocations with timing
- Retry attempts
- Compression events
- Error rates and types

**Gap in Crazycode:**
Basic bus events exist but no structured telemetry for monitoring and debugging.

**Recommendation:**
Implement a telemetry subsystem that:
- Tracks all significant events
- Exports to common formats (OpenTelemetry)
- Provides local debugging UI
- Respects privacy with opt-out

#### 5.2 Debug Logs Per Session (from Claude Code)

**What Claude Code does:**
```
~/.claude/debug/
├── session-abc123/
│   ├── operations.log
│   ├── hook-matches.log
│   └── file-snapshots/
```

**Gap in Crazycode:**
Session storage exists but lacks per-session debug logs that capture operation traces and hook matches.

**Recommendation:**
Add per-session debug logging that captures:
- All tool executions with inputs/outputs
- Hook trigger matches
- Permission decisions
- File snapshots before/after edits

---

### 6. Session & Memory Management

#### 6.1 Session Memory with Boundary UUIDs (from Claude Code)

**What Claude Code does:**
Writes organized memory structures with boundary UUID identifiers, enabling the system to maintain context boundaries across compaction.

**Gap in Crazycode:**
Session storage exists but lacks semantic memory boundaries.

**Recommendation:**
Add memory boundary markers that:
- Identify compaction points
- Allow resumption from specific boundaries
- Enable "memory replay" for debugging

#### 6.2 Thread Identity Encoding (from Claude Code)

**What Claude Code does:**
Session UUIDs encode continuity information, enabling sessions to be linked across time.

**Gap in Crazycode:**
Sessions have IDs but they don't encode relationship information.

**Recommendation:**
Consider encoding parent session IDs or fork points in session identifiers for better session graph navigation.

---

### 7. Configuration & Rules

#### 7.1 Rules-Based Command Allowlisting (from Codex)

**What Codex does:**
```toml
# ~/.codex/rules/default.rules
[shell_allow]
"npm *" = true
"git *" = true
"pytest *" = true
```

**Gap in Crazycode:**
Permission system uses tool-level controls but lacks command-pattern allowlisting.

**Recommendation:**
Add a rules engine for bash commands that:
- Allows pattern-based command approval
- Supports project-specific rule overrides
- Logs rule matches for auditing

#### 7.2 Per-Model Configuration (from Codex)

**What Codex does:**
```typescript
// ModelInfo drives per-model prompt templates, truncation policy, and tool support
interface ModelInfo {
  promptTemplate: string;
  truncationPolicy: TruncationConfig;
  supportedTools: string[];
}
```

**Gap in Crazycode:**
Model configuration is provider-level, not model-level. Different models from the same provider may need different settings.

**Recommendation:**
Extend model configuration to support:
- Per-model prompt templates
- Model-specific truncation policies
- Tool compatibility lists per model

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Loop Detection | High | Medium | **P1** |
| Multi-stage Compaction | High | High | **P1** |
| Quota Fallback | High | Low | **P1** |
| Tool Checkpoints | High | Medium | **P2** |
| Pre-compaction Hooks | Medium | Low | **P2** |
| Confirmation Bus | Medium | Medium | **P2** |
| Per-session Debug Logs | Medium | Low | **P2** |
| Structured Task Events | Medium | Medium | **P3** |
| Enhanced Sandboxing | High | High | **P3** |
| Command Allowlisting | Medium | Medium | **P3** |
| Telemetry System | Medium | High | **P3** |
| Memory Boundaries | Low | Medium | **P4** |

---

## Quick Wins (Low Effort, High Value)

1. **Quota Fallback Handler** - Simple to implement, prevents frustrating failures
2. **Pre-compaction Hooks** - Extend existing plugin system with new hook type
3. **Per-session Debug Logs** - Enhance existing storage with debug directory
4. **Configurable Compression Thresholds** - Add config options for existing compaction

---

## Architectural Considerations

### What Crazycode Already Does Well

1. **Provider Agnosticism** - 20+ providers supported, excellent flexibility
2. **LSP Integration** - First-class language server support is unique
3. **MCP Support** - Full Model Context Protocol implementation
4. **Multi-interface** - CLI, TUI, Desktop, Web all from same core
5. **Skill System** - Claude Code compatible skill format
6. **Plugin Architecture** - Clean hook-based extensibility

### Where Competition Excels

1. **Gemini CLI** - Superior safety mechanisms and failure handling
2. **Claude Code** - Best-in-class context management and compaction
3. **Codex** - Clean event-driven architecture with UI-friendly output

---

## Conclusion

Crazycode has a solid foundation with excellent provider support and LSP integration. The main opportunities for improvement lie in:

1. **Reliability** - Loop detection, checkpoints, and fallback handlers
2. **Context Management** - Multi-stage compaction with hooks
3. **Safety** - Enhanced sandboxing options
4. **Developer Experience** - Better debugging and observability

Implementing the P1 items (Loop Detection, Multi-stage Compaction, Quota Fallback) would significantly improve the robustness and user experience of Crazycode.

---

## References

- [harness-howto Repository](https://github.com/ParkerRex/harness-howto)
- [Claude Code Open Architecture](https://github.com/ParkerRex/harness-howto/tree/main/projects/claude-code-open)
- [Codex Architecture](https://github.com/ParkerRex/harness-howto/tree/main/projects/codex)
- [Gemini CLI Architecture](https://github.com/ParkerRex/harness-howto/tree/main/projects/gemini-cli)
