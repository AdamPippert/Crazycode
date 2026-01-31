import z from "zod"
import { Tool } from "../tool"
import { BrowserBridge } from "../../browser"

export const BrowserStatusTool = Tool.define("browser_status", {
  description:
    "Check the status of the browser bridge connection. Returns whether the bridge server is running and can communicate with the Chrome extension.",
  parameters: z.object({}),
  async execute(_params, _ctx) {
    const healthy = await BrowserBridge.isHealthy()

    if (!healthy) {
      return {
        output:
          "Browser bridge is not running.\n\nTo enable browser integration:\n1. Set CRAZYCODE_BROWSER=true environment variable, or\n2. Add `experimental.browser: true` to your config\n\nThen ensure the Crazycode Chrome extension is installed and active.",
        title: "browser status: disconnected",
        metadata: { connected: false },
      }
    }

    return {
      output:
        "Browser bridge is running and ready.\n\nThe bridge server is listening for connections from the Chrome extension.\nUse other browser_* tools to interact with the browser.",
      title: "browser status: connected",
      metadata: { connected: true },
    }
  },
})
