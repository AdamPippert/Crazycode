import z from "zod"
import { Tool } from "../tool"
import { BrowserBridge } from "../../browser"

export const BrowserExecuteTool = Tool.define("browser_execute", {
  description:
    "Execute JavaScript code in the context of the current page in Chrome browser. The code runs in the page context and can interact with the DOM. Returns the result of the expression.",
  parameters: z.object({
    code: z.string().describe("JavaScript code to execute in the page context"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "browser_execute",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const result = await BrowserBridge.executeAction("execute", {
      code: params.code,
    })

    if (!result.success) {
      return {
        output: `Failed to execute JavaScript: ${result.error}`,
        title: "execute failed",
        metadata: { success: false },
      }
    }

    const output =
      result.result !== undefined
        ? typeof result.result === "object"
          ? JSON.stringify(result.result, null, 2)
          : String(result.result)
        : "undefined"

    return {
      output: `Result:\n${output}`,
      title: "execute js",
      metadata: { success: true, result: result.result },
    }
  },
})
