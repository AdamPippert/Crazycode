import z from "zod"
import { Tool } from "../tool"
import { BrowserBridge } from "../../browser"

export const BrowserNavigateTool = Tool.define("browser_navigate", {
  description:
    "Navigate Chrome browser to a URL. The browser must have the Crazycode extension installed and connected. Use this to open web pages for testing, scraping, or interaction.",
  parameters: z.object({
    url: z.string().describe("Full URL to navigate to (must include http:// or https://)"),
    waitForLoad: z.boolean().optional().describe("Wait for page load to complete (default: true)"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "browser_navigate",
      patterns: [params.url],
      always: ["*"],
      metadata: {},
    })

    const result = await BrowserBridge.executeAction("navigate", {
      url: params.url,
      waitForLoad: params.waitForLoad ?? true,
    })

    return {
      output: result.success ? `Navigated to ${params.url}` : `Failed to navigate: ${result.error}`,
      title: params.url,
      metadata: { success: result.success, url: params.url },
    }
  },
})
