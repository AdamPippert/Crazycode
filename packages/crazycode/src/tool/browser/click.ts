import z from "zod"
import { Tool } from "../tool"
import { BrowserBridge } from "../../browser"

export const BrowserClickTool = Tool.define("browser_click", {
  description:
    "Click an element on the current page in Chrome browser. Use CSS selectors to identify the target element. Supports waiting for navigation after click.",
  parameters: z.object({
    selector: z.string().describe("CSS selector for the element to click (e.g., 'button.submit', '#login-btn')"),
    waitForNavigation: z.boolean().optional().describe("Wait for page navigation after click (default: false)"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "browser_click",
      patterns: [params.selector],
      always: ["*"],
      metadata: {},
    })

    const result = await BrowserBridge.executeAction("click", {
      selector: params.selector,
      waitForNavigation: params.waitForNavigation ?? false,
    })

    return {
      output: result.success ? `Clicked element: ${params.selector}` : `Failed to click: ${result.error}`,
      title: `click ${params.selector}`,
      metadata: { success: result.success, selector: params.selector },
    }
  },
})
