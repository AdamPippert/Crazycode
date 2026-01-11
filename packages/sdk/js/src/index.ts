export * from "./client.js"
export * from "./server.js"

import { createCrazycodeClient } from "./client.js"
import { createCrazycodeServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createCrazycode(options?: ServerOptions) {
  const server = await createCrazycodeServer({
    ...options,
  })

  const client = createCrazycodeClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
