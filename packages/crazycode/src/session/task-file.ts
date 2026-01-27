import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import { Instance } from "../project/instance"
import { Lock } from "../util/lock"
import { Log } from "../util/log"

export namespace TaskFile {
  const log = Log.create({ service: "task-file" })

  /**
   * Task status values for tracking sub-agent work
   */
  export const Status = z.enum([
    "pending", // Not yet started
    "in_progress", // Currently executing
    "completed", // Finished successfully
    "failed", // Finished with error
    "cancelled", // Terminated by user or parent
    "paused", // Manually suspended
  ])
  export type Status = z.infer<typeof Status>

  /**
   * Task file info stored in each task's JSON file
   */
  export const Info = z
    .object({
      id: z.string().describe("Unique task identifier"),
      parentTaskId: z.string().optional().describe("Parent task ID for nested tasks"),
      sessionId: z.string().describe("Associated session ID"),
      parentSessionId: z.string().optional().describe("Parent session that spawned this task"),
      projectId: z.string().describe("Project this task belongs to"),
      subject: z.string().describe("Brief task title"),
      description: z.string().describe("Detailed task description"),
      status: Status.describe("Current task status"),
      owner: z.string().optional().describe("Agent/subagent type handling this task"),
      activeForm: z.string().optional().describe("Display text shown during execution"),
      blockedBy: z.array(z.string()).default([]).describe("Task IDs this task depends on"),
      blocks: z.array(z.string()).default([]).describe("Task IDs waiting on this task"),
      progress: z
        .object({
          current: z.number().default(0),
          total: z.number().optional(),
          message: z.string().optional(),
        })
        .optional()
        .describe("Progress tracking"),
      output: z.string().optional().describe("Task output/result"),
      error: z.string().optional().describe("Error message if failed"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Custom metadata"),
      time: z.object({
        created: z.number().describe("Creation timestamp"),
        started: z.number().optional().describe("Start timestamp"),
        updated: z.number().describe("Last update timestamp"),
        completed: z.number().optional().describe("Completion timestamp"),
        paused: z.number().optional().describe("Pause timestamp"),
      }),
      toolSummary: z
        .array(
          z.object({
            id: z.string(),
            tool: z.string(),
            state: z.object({
              status: z.string(),
              title: z.string().optional(),
            }),
          }),
        )
        .optional()
        .describe("Summary of tool calls made during task execution"),
    })
    .meta({ ref: "TaskFile" })
  export type Info = z.infer<typeof Info>

  /**
   * Events for task file updates
   */
  export const Event = {
    Created: BusEvent.define(
      "taskfile.created",
      z.object({
        task: Info,
      }),
    ),
    Updated: BusEvent.define(
      "taskfile.updated",
      z.object({
        task: Info,
      }),
    ),
    Completed: BusEvent.define(
      "taskfile.completed",
      z.object({
        task: Info,
      }),
    ),
    Failed: BusEvent.define(
      "taskfile.failed",
      z.object({
        task: Info,
        error: z.string(),
      }),
    ),
  }

  /**
   * Get the tasks directory for the current project
   */
  function getTasksDir(): string {
    return path.join(Global.Path.data, "tasks", Instance.project.id)
  }

  /**
   * Get the file path for a specific task
   */
  function getTaskPath(taskId: string): string {
    return path.join(getTasksDir(), `${taskId}.json`)
  }

  /**
   * Get the output file path for a specific task
   */
  function getOutputPath(taskId: string): string {
    return path.join(getTasksDir(), `${taskId}.output`)
  }

  /**
   * Ensure the tasks directory exists
   */
  async function ensureTasksDir(): Promise<void> {
    await fs.mkdir(getTasksDir(), { recursive: true })
  }

  /**
   * Generate a short alphanumeric task ID (7 characters like ac88940)
   */
  export function generateId(): string {
    const chars = "0123456789abcdef"
    let result = ""
    const bytes = new Uint8Array(4)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < 7; i++) {
      result += chars[bytes[i % 4] % 16]
    }
    return result
  }

  /**
   * Create a new task file
   */
  export async function create(input: {
    subject: string
    description: string
    sessionId: string
    parentSessionId?: string
    parentTaskId?: string
    owner?: string
    blockedBy?: string[]
    metadata?: Record<string, unknown>
  }): Promise<Info> {
    await ensureTasksDir()

    const id = generateId()
    const now = Date.now()

    const task: Info = {
      id,
      parentTaskId: input.parentTaskId,
      sessionId: input.sessionId,
      parentSessionId: input.parentSessionId,
      projectId: Instance.project.id,
      subject: input.subject,
      description: input.description,
      status: "pending",
      owner: input.owner,
      blockedBy: input.blockedBy ?? [],
      blocks: [],
      time: {
        created: now,
        updated: now,
      },
      metadata: input.metadata,
    }

    const taskPath = getTaskPath(id)
    using _ = await Lock.write(taskPath)
    await Bun.write(taskPath, JSON.stringify(task, null, 2))

    log.info("created task", { id, subject: input.subject })
    Bus.publish(Event.Created, { task })

    return task
  }

  /**
   * Get a task by ID
   */
  export async function get(taskId: string): Promise<Info | null> {
    const taskPath = getTaskPath(taskId)
    try {
      using _ = await Lock.read(taskPath)
      const content = await Bun.file(taskPath).json()
      return Info.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Update a task
   */
  export async function update(
    taskId: string,
    updater: (task: Info) => void | Partial<Info>,
  ): Promise<Info | null> {
    const taskPath = getTaskPath(taskId)
    try {
      using _ = await Lock.write(taskPath)
      const content = await Bun.file(taskPath).json()
      const task = Info.parse(content)

      const updates = updater(task)
      if (updates) {
        Object.assign(task, updates)
      }
      task.time.updated = Date.now()

      await Bun.write(taskPath, JSON.stringify(task, null, 2))

      log.info("updated task", { id: taskId, status: task.status })
      Bus.publish(Event.Updated, { task })

      return task
    } catch (e) {
      log.error("failed to update task", { id: taskId, error: e })
      return null
    }
  }

  /**
   * Start a task (set status to in_progress)
   */
  export async function start(taskId: string, activeForm?: string): Promise<Info | null> {
    return update(taskId, (task) => {
      task.status = "in_progress"
      task.time.started = Date.now()
      if (activeForm) task.activeForm = activeForm
    })
  }

  /**
   * Complete a task successfully
   */
  export async function complete(
    taskId: string,
    output?: string,
    toolSummary?: Info["toolSummary"],
  ): Promise<Info | null> {
    const task = await update(taskId, (task) => {
      task.status = "completed"
      task.time.completed = Date.now()
      if (output) task.output = output
      if (toolSummary) task.toolSummary = toolSummary
    })

    if (task) {
      Bus.publish(Event.Completed, { task })

      // Unblock dependent tasks
      for (const blockedId of task.blocks) {
        await update(blockedId, (blocked) => {
          blocked.blockedBy = blocked.blockedBy.filter((id) => id !== taskId)
        })
      }
    }

    return task
  }

  /**
   * Mark a task as failed
   */
  export async function fail(taskId: string, error: string): Promise<Info | null> {
    const task = await update(taskId, (task) => {
      task.status = "failed"
      task.time.completed = Date.now()
      task.error = error
    })

    if (task) {
      Bus.publish(Event.Failed, { task, error })
    }

    return task
  }

  /**
   * Pause a task
   */
  export async function pause(taskId: string): Promise<Info | null> {
    return update(taskId, (task) => {
      task.status = "paused"
      task.time.paused = Date.now()
    })
  }

  /**
   * Cancel a task
   */
  export async function cancel(taskId: string): Promise<Info | null> {
    return update(taskId, (task) => {
      task.status = "cancelled"
      task.time.completed = Date.now()
    })
  }

  /**
   * Update task progress
   */
  export async function setProgress(
    taskId: string,
    progress: { current: number; total?: number; message?: string },
  ): Promise<Info | null> {
    return update(taskId, (task) => {
      task.progress = progress
    })
  }

  /**
   * Append to task output file
   */
  export async function appendOutput(taskId: string, content: string): Promise<void> {
    await ensureTasksDir()
    const outputPath = getOutputPath(taskId)
    const file = Bun.file(outputPath)
    const existing = await file.text().catch(() => "")
    await Bun.write(outputPath, existing + content)
  }

  /**
   * Get task output file content
   */
  export async function getOutput(taskId: string): Promise<string | null> {
    const outputPath = getOutputPath(taskId)
    try {
      return await Bun.file(outputPath).text()
    } catch {
      return null
    }
  }

  /**
   * List all tasks for the current project
   */
  export async function list(options?: {
    status?: Status
    parentSessionId?: string
    owner?: string
  }): Promise<Info[]> {
    await ensureTasksDir()
    const tasksDir = getTasksDir()

    const files = await fs.readdir(tasksDir).catch(() => [])
    const tasks: Info[] = []

    for (const file of files) {
      if (!file.endsWith(".json")) continue
      const taskPath = path.join(tasksDir, file)
      try {
        const content = await Bun.file(taskPath).json()
        const task = Info.parse(content)

        // Apply filters
        if (options?.status && task.status !== options.status) continue
        if (options?.parentSessionId && task.parentSessionId !== options.parentSessionId) continue
        if (options?.owner && task.owner !== options.owner) continue

        tasks.push(task)
      } catch {
        // Skip invalid files
      }
    }

    // Sort by creation time (newest first)
    return tasks.sort((a, b) => b.time.created - a.time.created)
  }

  /**
   * List active (in_progress or pending) tasks for a parent session
   */
  export async function listActive(parentSessionId: string): Promise<Info[]> {
    const tasks = await list({ parentSessionId })
    return tasks.filter((t) => t.status === "in_progress" || t.status === "pending")
  }

  /**
   * Get tasks by session ID
   */
  export async function getBySession(sessionId: string): Promise<Info[]> {
    const all = await list()
    return all.filter((t) => t.sessionId === sessionId)
  }

  /**
   * Delete a task file
   */
  export async function remove(taskId: string): Promise<boolean> {
    const taskPath = getTaskPath(taskId)
    const outputPath = getOutputPath(taskId)
    try {
      await fs.unlink(taskPath).catch(() => {})
      await fs.unlink(outputPath).catch(() => {})
      log.info("removed task", { id: taskId })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get a formatted status display for a task
   */
  export function formatStatus(task: Info): string {
    const elapsed = Date.now() - task.time.created
    const minutes = Math.floor(elapsed / 60000)

    let timeStr: string
    if (minutes < 1) {
      timeStr = "just now"
    } else if (minutes < 60) {
      timeStr = `${minutes} min`
    } else {
      const hours = Math.floor(minutes / 60)
      timeStr = `${hours}h ${minutes % 60}m`
    }

    const statusIcon: Record<Status, string> = {
      pending: "○",
      in_progress: "▶",
      completed: "✓",
      failed: "✗",
      cancelled: "⊘",
      paused: "⏸",
    }

    return `${statusIcon[task.status]} ${task.id}: ${task.subject} (${task.status}, ${timeStr})`
  }
}
