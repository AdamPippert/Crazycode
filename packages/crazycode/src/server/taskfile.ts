import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { TaskFile } from "../session/task-file"
import { errors } from "./error"
import { Storage } from "../storage/storage"

/**
 * TaskFile API routes for managing sub-agent task files
 */
export const TaskFileRoute = new Hono()
  .get(
    "/",
    describeRoute({
      summary: "List task files",
      description: "Get a list of all task files for the current project",
      operationId: "taskfile.list",
      responses: {
        200: {
          description: "List of task files",
          content: {
            "application/json": {
              schema: resolver(TaskFile.Info.array()),
            },
          },
        },
      },
    }),
    validator(
      "query",
      z.object({
        status: TaskFile.Status.optional(),
        parentSessionId: z.string().optional(),
        owner: z.string().optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query")
      const tasks = await TaskFile.list({
        status: query.status,
        parentSessionId: query.parentSessionId,
        owner: query.owner,
      })
      return c.json(tasks)
    },
  )
  .get(
    "/active",
    describeRoute({
      summary: "List active task files",
      description: "Get a list of active (in_progress or pending) task files for a parent session",
      operationId: "taskfile.listActive",
      responses: {
        200: {
          description: "List of active task files",
          content: {
            "application/json": {
              schema: resolver(TaskFile.Info.array()),
            },
          },
        },
      },
    }),
    validator("query", z.object({ parentSessionId: z.string() })),
    async (c) => {
      const { parentSessionId } = c.req.valid("query")
      const tasks = await TaskFile.listActive(parentSessionId)
      return c.json(tasks)
    },
  )
  .get(
    "/:taskId",
    describeRoute({
      summary: "Get task file",
      description: "Get a specific task file by ID",
      operationId: "taskfile.get",
      responses: {
        200: {
          description: "Task file info",
          content: {
            "application/json": {
              schema: resolver(TaskFile.Info),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ taskId: z.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param")
      const task = await TaskFile.get(taskId)
      if (!task) {
        throw new Storage.NotFoundError({ message: `Task ${taskId} not found` })
      }
      return c.json(task)
    },
  )
  .get(
    "/:taskId/output",
    describeRoute({
      summary: "Get task output",
      description: "Get the output file content for a specific task",
      operationId: "taskfile.getOutput",
      responses: {
        200: {
          description: "Task output content",
          content: {
            "application/json": {
              schema: resolver(z.object({ output: z.string().nullable() })),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ taskId: z.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param")
      const output = await TaskFile.getOutput(taskId)
      return c.json({ output })
    },
  )
  .post(
    "/",
    describeRoute({
      summary: "Create task file",
      description: "Create a new task file to track sub-agent work",
      operationId: "taskfile.create",
      responses: {
        200: {
          description: "Created task file",
          content: {
            "application/json": {
              schema: resolver(TaskFile.Info),
            },
          },
        },
        ...errors(400),
      },
    }),
    validator(
      "json",
      z.object({
        subject: z.string().describe("Brief task title"),
        description: z.string().describe("Detailed task description"),
        sessionId: z.string().describe("Associated session ID"),
        parentSessionId: z.string().optional().describe("Parent session that spawned this task"),
        parentTaskId: z.string().optional().describe("Parent task ID for nested tasks"),
        owner: z.string().optional().describe("Agent/subagent type handling this task"),
        blockedBy: z.array(z.string()).optional().describe("Task IDs this task depends on"),
        metadata: z.record(z.string(), z.unknown()).optional().describe("Custom metadata"),
      }),
    ),
    async (c) => {
      const input = c.req.valid("json")
      const task = await TaskFile.create(input)
      return c.json(task)
    },
  )
  .put(
    "/:taskId",
    describeRoute({
      summary: "Update task file",
      description: "Update a task file status or properties",
      operationId: "taskfile.update",
      responses: {
        200: {
          description: "Updated task file",
          content: {
            "application/json": {
              schema: resolver(TaskFile.Info),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ taskId: z.string() })),
    validator(
      "json",
      z.object({
        status: TaskFile.Status.optional(),
        activeForm: z.string().optional(),
        output: z.string().optional(),
        error: z.string().optional(),
        progress: z
          .object({
            current: z.number(),
            total: z.number().optional(),
            message: z.string().optional(),
          })
          .optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
    async (c) => {
      const { taskId } = c.req.valid("param")
      const updates = c.req.valid("json")
      const task = await TaskFile.update(taskId, (t) => {
        if (updates.status) t.status = updates.status
        if (updates.activeForm) t.activeForm = updates.activeForm
        if (updates.output) t.output = updates.output
        if (updates.error) t.error = updates.error
        if (updates.progress) t.progress = updates.progress
        if (updates.metadata) t.metadata = { ...t.metadata, ...updates.metadata }
      })
      if (!task) {
        throw new Storage.NotFoundError({ message: `Task ${taskId} not found` })
      }
      return c.json(task)
    },
  )
  .post(
    "/:taskId/start",
    describeRoute({
      summary: "Start task",
      description: "Mark a task as in progress",
      operationId: "taskfile.start",
      responses: {
        200: {
          description: "Started task file",
          content: {
            "application/json": {
              schema: resolver(TaskFile.Info),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ taskId: z.string() })),
    validator("json", z.object({ activeForm: z.string().optional() })),
    async (c) => {
      const { taskId } = c.req.valid("param")
      const { activeForm } = c.req.valid("json")
      const task = await TaskFile.start(taskId, activeForm)
      if (!task) {
        throw new Storage.NotFoundError({ message: `Task ${taskId} not found` })
      }
      return c.json(task)
    },
  )
  .post(
    "/:taskId/complete",
    describeRoute({
      summary: "Complete task",
      description: "Mark a task as completed",
      operationId: "taskfile.complete",
      responses: {
        200: {
          description: "Completed task file",
          content: {
            "application/json": {
              schema: resolver(TaskFile.Info),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ taskId: z.string() })),
    validator(
      "json",
      z.object({
        output: z.string().optional(),
        toolSummary: TaskFile.Info.shape.toolSummary.optional(),
      }),
    ),
    async (c) => {
      const { taskId } = c.req.valid("param")
      const { output, toolSummary } = c.req.valid("json")
      const task = await TaskFile.complete(taskId, output, toolSummary)
      if (!task) {
        throw new Storage.NotFoundError({ message: `Task ${taskId} not found` })
      }
      return c.json(task)
    },
  )
  .post(
    "/:taskId/fail",
    describeRoute({
      summary: "Fail task",
      description: "Mark a task as failed with an error",
      operationId: "taskfile.fail",
      responses: {
        200: {
          description: "Failed task file",
          content: {
            "application/json": {
              schema: resolver(TaskFile.Info),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ taskId: z.string() })),
    validator("json", z.object({ error: z.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param")
      const { error } = c.req.valid("json")
      const task = await TaskFile.fail(taskId, error)
      if (!task) {
        throw new Storage.NotFoundError({ message: `Task ${taskId} not found` })
      }
      return c.json(task)
    },
  )
  .post(
    "/:taskId/cancel",
    describeRoute({
      summary: "Cancel task",
      description: "Mark a task as cancelled",
      operationId: "taskfile.cancel",
      responses: {
        200: {
          description: "Cancelled task file",
          content: {
            "application/json": {
              schema: resolver(TaskFile.Info),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ taskId: z.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param")
      const task = await TaskFile.cancel(taskId)
      if (!task) {
        throw new Storage.NotFoundError({ message: `Task ${taskId} not found` })
      }
      return c.json(task)
    },
  )
  .post(
    "/:taskId/pause",
    describeRoute({
      summary: "Pause task",
      description: "Pause a task temporarily",
      operationId: "taskfile.pause",
      responses: {
        200: {
          description: "Paused task file",
          content: {
            "application/json": {
              schema: resolver(TaskFile.Info),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ taskId: z.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param")
      const task = await TaskFile.pause(taskId)
      if (!task) {
        throw new Storage.NotFoundError({ message: `Task ${taskId} not found` })
      }
      return c.json(task)
    },
  )
  .delete(
    "/:taskId",
    describeRoute({
      summary: "Delete task file",
      description: "Remove a task file",
      operationId: "taskfile.remove",
      responses: {
        200: {
          description: "Task removed",
          content: {
            "application/json": {
              schema: resolver(z.boolean()),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ taskId: z.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param")
      const success = await TaskFile.remove(taskId)
      return c.json(success)
    },
  )
