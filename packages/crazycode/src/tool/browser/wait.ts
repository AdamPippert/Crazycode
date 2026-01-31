import z from "zod"
import { Tool } from "../tool"
import { BrowserBridge } from "../../browser"

export const BrowserWaitTool = Tool.define("browser_wait", {
  description:
    "Wait for an element to appear on the page or for a specified duration. Useful for waiting for dynamic content to load or for timing between interactions.",
  parameters: z.object({
    selector: z.string().optional().describe("CSS selector for an element to wait for (waits until element exists)"),
    timeout: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum time to wait in milliseconds (default: 5000 for selector, required for time-based wait)"),
  }),
  async execute(params, ctx) {
    if (!params.selector && !params.timeout) {
      return {
        output: "Either 'selector' or 'timeout' must be provided",
        title: "wait failed",
        metadata: { success: false, selector: params.selector, timeout: params.timeout },
      }
    }

    await ctx.ask({
      permission: "browser_wait",
      patterns: [params.selector ?? "*"],
      always: ["*"],
      metadata: {},
    })

    const result = await BrowserBridge.executeAction("wait", {
      selector: params.selector,
      timeout: params.timeout ?? (params.selector ? 5000 : undefined),
    })

    if (!result.success) {
      return {
        output: `Wait failed: ${result.error}`,
        title: "wait failed",
        metadata: { success: false, selector: params.selector, timeout: params.timeout },
      }
    }

    const description = params.selector
      ? `Element "${params.selector}" found`
      : `Waited ${params.timeout}ms`

    return {
      output: description,
      title: params.selector ? `wait for ${params.selector}` : `wait ${params.timeout}ms`,
      metadata: { success: true, selector: params.selector, timeout: params.timeout },
    }
  },
})
