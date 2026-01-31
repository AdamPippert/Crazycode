export interface BrowserResponse {
  success: boolean
  result?: any
  error?: string
  screenshot?: string
}

export interface BrowserAction {
  action: string
  [key: string]: any
}

export interface BrowserConfig {
  port: number
  enabled: boolean
}
