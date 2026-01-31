import z from "zod"
import { Tool } from "../tool"
import { BrowserBridge } from "../../browser"

export const BrowserTypeTool = Tool.define("browser_type", {
  description:
    "Type text into an input field in Chrome browser. Can target a specific element via CSS selector or type into the currently focused element.",
  parameters: z.object({
    text: z.string().describe("The text to type"),
    selector: z
      .string()
      .optional()
      .describe("CSS selector for the input element (if not provided, types into focused element)"),
    clearFirst: z.boolean().optional().describe("Clear the input field before typing (default: false)"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "browser_type",
      patterns: [params.selector ?? "*"],
      always: ["*"],
      metadata: {},
    })

    const result = await BrowserBridge.executeAction("type", {
      text: params.text,
      selector: params.selector,
      clearFirst: params.clearFirst ?? false,
    })

    const target = params.selector ?? "focused element"
    return {
      output: result.success ? `Typed "${params.text}" into ${target}` : `Failed to type: ${result.error}`,
      title: `type into ${target}`,
      metadata: { success: result.success, text: params.text, selector: params.selector },
    }
  },
})
