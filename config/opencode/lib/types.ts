import { Data, Schema } from "effect"

export class SwarmError extends Data.TaggedError("SwarmError")<{
  message: string
  cause?: unknown
}> {}

export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{
  sessionId: string
}> {}

export class TaskNotFound extends Data.TaggedError("TaskNotFound")<{
  taskId: string
}> {}

export class NotGitRepo extends Data.TaggedError("NotGitRepo")<{
  path: string
}> {}

export class UncommittedChanges extends Data.TaggedError("UncommittedChanges")<{
  path: string
}> {}

export class GitError extends Data.TaggedError("GitError")<{
  operation: string
  cause?: unknown
}> {}

export class FileError extends Data.TaggedError("FileError")<{
  operation: string
  path: string
  cause?: unknown
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string
  cause?: unknown
}> {}

export const SWARM_DIR = `${process.env.HOME}/.swarm`
export const WORKTREES_DIR = `${SWARM_DIR}/worktrees`
export const SESSIONS_DIR = `${SWARM_DIR}/sessions`
export const MAX_PARALLEL_WORKERS = 3
export const MAX_REVIEW_ATTEMPTS = 3
export const SESSION_TTL_DAYS = 7

export const SubtaskSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
  files: Schema.Array(Schema.String),
  dependencies: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  complexity: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
})

export const EpicSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
})

export const PlanSchema = Schema.Struct({
  session_id: Schema.String,
  project_path: Schema.String,
  branch: Schema.String,
  start_commit: Schema.String,
  task: Schema.String,
  created_at: Schema.String,
  epic: EpicSchema,
  subtasks: Schema.Array(SubtaskSchema),
})

export const TaskStatusSchema = Schema.Literal(
  "pending",
  "running",
  "reviewing",
  "complete",
  "failed",
  "cancelled",
)

export const TaskStateSchema = Schema.Struct({
  status: TaskStatusSchema,
  worktree: Schema.optional(Schema.String),
  worker_id: Schema.optional(Schema.String),
  started_at: Schema.optional(Schema.String),
  completed_at: Schema.optional(Schema.String),
  commit: Schema.optional(Schema.String),
  review_attempts: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  error: Schema.optional(Schema.String),
})

export const TasksStateSchema = Schema.Record({ key: Schema.String, value: TaskStateSchema })

export const MessageTypeSchema = Schema.Literal(
  "progress",
  "complete",
  "blocker",
  "question",
  "feedback",
  "approved",
  "spawn",
)

export const MessageSchema = Schema.Struct({
  id: Schema.String,
  from: Schema.String,
  to: Schema.String,
  type: MessageTypeSchema,
  message: Schema.String,
  data: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  timestamp: Schema.String,
})

export const ReviewIssueSchema = Schema.Struct({
  file: Schema.String,
  line: Schema.optional(Schema.Number),
  issue: Schema.String,
  suggestion: Schema.optional(Schema.String),
})

export const ReviewFeedbackSchema = Schema.Struct({
  status: Schema.Literal("needs_changes", "approved"),
  issues: Schema.optional(Schema.Array(ReviewIssueSchema)),
  summary: Schema.optional(Schema.String),
})

export const FailureSchema = Schema.Struct({
  failed_task: Schema.String,
  error: Schema.String,
  attempt: Schema.Number,
  completed_tasks: Schema.Array(Schema.String),
  pending_tasks: Schema.Array(Schema.String),
  timestamp: Schema.String,
})

export type Subtask = typeof SubtaskSchema.Type
export type Epic = typeof EpicSchema.Type
export type Plan = typeof PlanSchema.Type
export type TaskStatus = typeof TaskStatusSchema.Type
export type TaskState = typeof TaskStateSchema.Type
export type TasksState = typeof TasksStateSchema.Type
export type MessageType = typeof MessageTypeSchema.Type
export type Message = typeof MessageSchema.Type
export type ReviewFeedback = typeof ReviewFeedbackSchema.Type
export type Failure = typeof FailureSchema.Type

export function getSessionDir(sessionId: string): string {
  return `${SESSIONS_DIR}/${sessionId}`
}

export function getPlanPath(sessionId: string): string {
  return `${getSessionDir(sessionId)}/plan.json`
}

export function getTasksPath(sessionId: string): string {
  return `${getSessionDir(sessionId)}/tasks.json`
}

export function getMessagesDir(sessionId: string): string {
  return `${getSessionDir(sessionId)}/messages`
}

export function getMessagePath(sessionId: string, agentId: string): string {
  return `${getMessagesDir(sessionId)}/${agentId}.jsonl`
}

export function getFailurePath(sessionId: string): string {
  return `${getSessionDir(sessionId)}/failure.json`
}

export function getWorktreePath(projectName: string, taskId: string): string {
  return `${WORKTREES_DIR}/${projectName}-${taskId}`
}
