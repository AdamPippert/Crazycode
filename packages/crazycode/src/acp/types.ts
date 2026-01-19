import type { McpServer } from "@agentclientprotocol/sdk"
import type { CrazycodeClient } from "@crazycode-ai/sdk/v2"

export interface ACPSessionState {
  id: string
  cwd: string
  mcpServers: McpServer[]
  createdAt: Date
  model?: {
    providerID: string
    modelID: string
  }
  modeId?: string
}

export interface ACPConfig {
  sdk: CrazycodeClient
  defaultModel?: {
    providerID: string
    modelID: string
  }
}
