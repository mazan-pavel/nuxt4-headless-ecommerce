/** Minimal WebMCP DOM typings for Chrome's Imperative + Declarative APIs. */

interface WebMcpJsonSchema {
  type: 'object'
  properties: Record<string, WebMcpJsonSchemaProperty>
  required?: string[]
}

interface WebMcpJsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array'
  description?: string
  enum?: Array<string | number>
  minimum?: number
  maximum?: number
  default?: string | number | boolean
}

interface WebMcpToolAnnotations {
  readOnlyHint?: boolean
  untrustedContentHint?: boolean
  consequentialHint?: boolean
  debugging?: boolean
}

interface WebMcpToolExecuteOptions {
  signal?: AbortSignal
}

type WebMcpToolExecuteResult = string | Record<string, unknown> | null

interface WebMcpToolDefinition<TInput extends Record<string, unknown> = Record<string, unknown>> {
  name: string
  description: string
  inputSchema: WebMcpJsonSchema
  annotations?: WebMcpToolAnnotations
  execute: (
    input: TInput,
    options: WebMcpToolExecuteOptions,
  ) => Promise<WebMcpToolExecuteResult> | WebMcpToolExecuteResult
}

interface WebMcpRegisterToolOptions {
  signal?: AbortSignal
  exposedTo?: string[]
}

interface ModelContext {
  registerTool: (
    tool: WebMcpToolDefinition,
    options?: WebMcpRegisterToolOptions,
  ) => Promise<void>
  getTools: () => Promise<unknown[]>
  executeTool: (
    tool: unknown,
    input?: Record<string, unknown>,
    options?: WebMcpRegisterToolOptions,
  ) => Promise<WebMcpToolExecuteResult>
}

interface AgentSubmitEvent extends SubmitEvent {
  agentInvoked?: boolean
  respondWith?: (response: Promise<WebMcpToolExecuteResult>) => void
}

interface Document {
  readonly modelContext?: ModelContext
}

interface WindowEventMap {
  toolactivated: Event & { toolName?: string }
  toolcancel: Event & { toolName?: string }
}
