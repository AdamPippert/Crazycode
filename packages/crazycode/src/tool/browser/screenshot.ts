import z from "zod"
import { Tool } from "../tool"
import { BrowserBridge } from "../../browser"

export const BrowserScreenshotTool = Tool.define("browser_screenshot", {
  description:
    "Capture a screenshot of the current page in Chrome browser. Returns the screenshot as a base64-encoded image. Can capture full page or just the visible viewport.",
  parameters: z.object({
    fullPage: z
      .boolean()
      .optional()
      .describe("Capture the full scrollable page (default: false, captures viewport only)"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "browser_screenshot",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const result = await BrowserBridge.executeAction("screenshot", {
      fullPage: params.fullPage ?? false,
    })

    if (!result.success) {
      return {
        output: `Failed to capture screenshot: ${result.error}`,
        title: "screenshot failed",
        metadata: { success: false, fullPage: params.fullPage },
      }
    }

    const output = result.screenshot
      ? `Screenshot captured (${params.fullPage ? "full page" : "viewport"}):\n\n![Screenshot](data:image/png;base64,${result.screenshot})`
      : "Screenshot captured but no image data returned"

    return {
      output,
      title: params.fullPage ? "full page screenshot" : "viewport screenshot",
      metadata: { success: true, fullPage: params.fullPage },
    }
  },
})
