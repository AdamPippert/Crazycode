import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import type { BrowserResponse, BrowserConfig, BrowserAction } from "./types"

const log = Log.create({ service: "browser.bridge" })

const ACTION_TIMEOUT_MS = 30000

interface PendingAction {
  action: BrowserAction
  resolve: (response: BrowserResponse) => void
  reject: (error: Error) => void
  timestamp: number
}

interface BridgeState {
  server: ReturnType<typeof Bun.serve> | null
  pendingActions: Map<string, PendingAction>
  completedActions: Map<string, BrowserResponse>
  config: BrowserConfig
  actionCounter: number
}

export const BrowserBridge = {
  state: Instance.state<BridgeState>(
    () => ({
      server: null,
      pendingActions: new Map(),
      completedActions: new Map(),
      config: { port: 9333, enabled: false },
      actionCounter: 0,
    }),
    async (state) => {
      if (state.server) {
        state.server.stop()
        log.info("browser bridge server stopped")
      }
    },
  ),

  async start(config: BrowserConfig): Promise<void> {
    const state = await this.state()
    if (state.server) {
      log.debug("browser bridge already running")
      return
    }

    state.config = config

    state.server = Bun.serve({
      port: config.port,
      fetch: async (req) => {
        const url = new URL(req.url)
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }

        if (req.method === "OPTIONS") {
          return new Response(null, { status: 204, headers: cors })
        }

        if (url.pathname === "/health") {
          return Response.json({ status: "ok", timestamp: Date.now() }, { headers: cors })
        }

        if (url.pathname === "/get-action" && req.method === "GET") {
          const action = this.getNextPendingAction(state)
          if (action) {
            return Response.json(action, { headers: cors })
          }
          return Response.json({ action: null }, { headers: cors })
        }

        if (url.pathname === "/complete-action" && req.method === "POST") {
          const body = (await req.json()) as { id: string; response: BrowserResponse }
          this.completeAction(state, body.id, body.response)
          return Response.json({ status: "ok" }, { headers: cors })
        }

        return new Response("Not found", { status: 404, headers: cors })
      },
    })

    log.info("browser bridge server started", { port: config.port })

    setInterval(() => this.cleanupStaleActions(state), 5000)
  },

  getNextPendingAction(state: BridgeState): { id: string; action: BrowserAction } | null {
    for (const [id, pending] of state.pendingActions) {
      return { id, action: pending.action }
    }
    return null
  },

  completeAction(state: BridgeState, id: string, response: BrowserResponse): void {
    const pending = state.pendingActions.get(id)
    if (pending) {
      state.pendingActions.delete(id)
      state.completedActions.set(id, response)
      pending.resolve(response)
      log.debug("action completed", { id, success: response.success })
    }
  },

  cleanupStaleActions(state: BridgeState): void {
    const now = Date.now()
    for (const [id, pending] of state.pendingActions) {
      if (now - pending.timestamp > ACTION_TIMEOUT_MS) {
        state.pendingActions.delete(id)
        pending.reject(new Error(`Browser action timed out after ${ACTION_TIMEOUT_MS}ms`))
        log.warn("action timed out", { id })
      }
    }

    for (const [id, _response] of state.completedActions) {
      state.completedActions.delete(id)
    }
  },

  async executeAction(action: string, params: Record<string, any> = {}): Promise<BrowserResponse> {
    const state = await this.state()

    if (!state.server) {
      return {
        success: false,
        error: "Browser bridge not started. Set CRAZYCODE_BROWSER=true or config experimental.browser: true",
      }
    }

    const id = `action_${++state.actionCounter}_${Date.now()}`
    const browserAction: BrowserAction = { action, ...params }

    return new Promise((resolve, reject) => {
      state.pendingActions.set(id, {
        action: browserAction,
        resolve,
        reject,
        timestamp: Date.now(),
      })

      log.debug("action queued", { id, action })
    })
  },

  async isHealthy(): Promise<boolean> {
    const state = await this.state()
    return state.server !== null
  },
}
