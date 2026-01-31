/**
 * Application-wide constants and configuration
 */
export const config = {
  // Base URL
  baseUrl: "https://crazycode.ai",

  // GitHub
  github: {
    repoUrl: "https://github.com/AdamPippert/CrazyCode",
    starsFormatted: {
      compact: "80K",
      full: "80,000",
    },
  },

  // Social links
  social: {
    twitter: "https://x.com/CrazyCodeAI",
    discord: "https://discord.gg/crazycode",
  },

  // Static stats (used on landing page)
  stats: {
    contributors: "600",
    commits: "7,500",
    monthlyUsers: "1.5M",
  },
} as const
