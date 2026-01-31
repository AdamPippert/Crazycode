import z from "zod"
import { Tool } from "../tool"
import { BrowserBridge } from "../../browser"

export const BrowserContentTool = Tool.define("browser_content", {
  description:
    "Get the content of the current page or a specific element in Chrome browser. Can return either text content or HTML. Useful for scraping or verifying page state.",
  parameters: z.object({
    selector: z
      .string()
      .optional()
      .describe("CSS selector for a specific element (if not provided, returns full page content)"),
    type: z.enum(["text", "html"]).optional().describe("Type of content to return (default: 'text')"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "browser_content",
      patterns: [params.selector ?? "*"],
      always: ["*"],
      metadata: {},
    })

    const result = await BrowserBridge.executeAction("content", {
      selector: params.selector,
      type: params.type ?? "text",
    })

    if (!result.success) {
      return {
        output: `Failed to get content: ${result.error}`,
        title: "content failed",
        metadata: { success: false, selector: params.selector, type: params.type },
      }
    }

    const target = params.selector ?? "page"
    return {
      output: result.result ?? "No content returned",
      title: `${params.type ?? "text"} content of ${target}`,
      metadata: { success: true, selector: params.selector, type: params.type },
    }
  },
})
