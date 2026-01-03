/**
 * swarm file system utilities
 *
 * effect-based file operations for swarm state management
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { Effect, pipe } from "effect";
import type { Failure, Message, Plan, TasksState } from "./types";
import {
  FileError,
  getFailurePath,
  getMessagePath,
  getMessagesDir,
  getPlanPath,
  getSessionDir,
  getTasksPath,
  SESSION_TTL_DAYS,
  SESSIONS_DIR,
  SWARM_DIR,
  WORKTREES_DIR,
} from "./types";

export const ensureDir = (path: string): Effect.Effect<void, FileError> =>
  Effect.try({
    try: () => {
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    },
    catch: (cause) => new FileError({ operation: "mkdir", path, cause }),
  });

export const ensureSwarmDirs = (): Effect.Effect<void, FileError> =>
  pipe(
    Effect.all([
      ensureDir(SWARM_DIR),
      ensureDir(SESSIONS_DIR),
      ensureDir(WORKTREES_DIR),
    ]),
    Effect.asVoid,
  );

export const ensureSessionDir = (
  sessionId: string,
): Effect.Effect<void, FileError> =>
  pipe(
    ensureDir(getSessionDir(sessionId)),
    Effect.flatMap(() => ensureDir(getMessagesDir(sessionId))),
  );

const readJson = <T>(path: string): Effect.Effect<T | null, FileError> =>
  Effect.try({
    try: () => {
      if (!existsSync(path)) return null;
      const content = readFileSync(path, "utf-8");
      return JSON.parse(content) as T;
    },
    catch: (cause) => new FileError({ operation: "read", path, cause }),
  });

const writeJson = <T>(path: string, data: T): Effect.Effect<void, FileError> =>
  Effect.try({
    try: () => {
      const dir = dirname(path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(path, JSON.stringify(data, null, 2));
    },
    catch: (cause) => new FileError({ operation: "write", path, cause }),
  });

export const readPlan = (
  sessionId: string,
): Effect.Effect<Plan | null, FileError> => readJson<Plan>(getPlanPath(sessionId));

export const writePlan = (
  sessionId: string,
  plan: Plan,
): Effect.Effect<void, FileError> =>
  pipe(
    ensureSessionDir(sessionId),
    Effect.flatMap(() => writeJson(getPlanPath(sessionId), plan)),
  );

export const readTasks = (
  sessionId: string,
): Effect.Effect<TasksState, FileError> =>
  pipe(
    readJson<TasksState>(getTasksPath(sessionId)),
    Effect.map((tasks) => tasks ?? {}),
  );

export const writeTasks = (
  sessionId: string,
  tasks: TasksState,
): Effect.Effect<void, FileError> => writeJson(getTasksPath(sessionId), tasks);

export const updateTask = (
  sessionId: string,
  taskId: string,
  update: Partial<TasksState[string]>,
): Effect.Effect<TasksState, FileError> =>
  pipe(
    readTasks(sessionId),
    Effect.flatMap((tasks) => {
      const updated = {
        ...tasks,
        [taskId]: { ...tasks[taskId], ...update },
      };
      return pipe(
        writeTasks(sessionId, updated),
        Effect.as(updated),
      );
    }),
  );

export const appendMessage = (
  sessionId: string,
  agentId: string,
  message: Message,
): Effect.Effect<void, FileError> =>
  Effect.try({
    try: () => {
      const dir = getMessagesDir(sessionId);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      appendFileSync(
        getMessagePath(sessionId, agentId),
        `${JSON.stringify(message)}\n`,
      );
    },
    catch: (cause) =>
      new FileError({
        operation: "append",
        path: getMessagePath(sessionId, agentId),
        cause,
      }),
  });

export const readMessages = (
  sessionId: string,
  agentId: string,
  limit = 10,
): Effect.Effect<Message[], FileError> =>
  Effect.try({
    try: () => {
      const path = getMessagePath(sessionId, agentId);
      if (!existsSync(path)) return [];
      const content = readFileSync(path, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      return lines.slice(-limit).map((line) => JSON.parse(line) as Message);
    },
    catch: (cause) =>
      new FileError({
        operation: "read",
        path: getMessagePath(sessionId, agentId),
        cause,
      }),
  });

export const writeFailure = (
  sessionId: string,
  failure: Failure,
): Effect.Effect<void, FileError> => writeJson(getFailurePath(sessionId), failure);

export const readFailure = (
  sessionId: string,
): Effect.Effect<Failure | null, FileError> =>
  readJson<Failure>(getFailurePath(sessionId));

export const deleteSessionFiles = (
  sessionId: string,
  keepPlanAndFailure = false,
): Effect.Effect<void, FileError> =>
  Effect.try({
    try: () => {
      const sessionDir = getSessionDir(sessionId);
      if (!existsSync(sessionDir)) return;

      if (keepPlanAndFailure) {
        const messagesDir = getMessagesDir(sessionId);
        if (existsSync(messagesDir)) {
          rmSync(messagesDir, { recursive: true, force: true });
        }
        const tasksPath = getTasksPath(sessionId);
        if (existsSync(tasksPath)) {
          rmSync(tasksPath);
        }
      } else {
        rmSync(sessionDir, { recursive: true, force: true });
      }
    },
    catch: (cause) =>
      new FileError({
        operation: "delete",
        path: getSessionDir(sessionId),
        cause,
      }),
  });

export const cleanupOldSessions = (): Effect.Effect<string[], FileError> =>
  Effect.try({
    try: () => {
      if (!existsSync(SESSIONS_DIR)) return [];

      const now = Date.now();
      const ttlMs = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
      const deleted: string[] = [];

      const sessions = readdirSync(SESSIONS_DIR);
      for (const session of sessions) {
        const sessionDir = `${SESSIONS_DIR}/${session}`;
        const stat = statSync(sessionDir);
        if (now - stat.mtimeMs > ttlMs) {
          rmSync(sessionDir, { recursive: true, force: true });
          deleted.push(session);
        }
      }

      return deleted;
    },
    catch: (cause) =>
      new FileError({ operation: "cleanup", path: SESSIONS_DIR, cause }),
  });

export const findActiveSession = (
  projectPath: string,
): Effect.Effect<string | null, FileError> =>
  Effect.try({
    try: () => {
      if (!existsSync(SESSIONS_DIR)) return null;

      const sessions = readdirSync(SESSIONS_DIR);
      for (const session of sessions) {
        const planPath = getPlanPath(session);
        if (existsSync(planPath)) {
          const plan = JSON.parse(readFileSync(planPath, "utf-8")) as Plan;
          if (plan.project_path === projectPath) {
            const failurePath = getFailurePath(session);
            if (!existsSync(failurePath)) {
              return session;
            }
          }
        }
      }
      return null;
    },
    catch: (cause) =>
      new FileError({ operation: "find", path: SESSIONS_DIR, cause }),
  });

export const findLatestSession = (
  projectPath: string,
): Effect.Effect<string | null, FileError> =>
  Effect.try({
    try: () => {
      if (!existsSync(SESSIONS_DIR)) return null;

      const sessions = readdirSync(SESSIONS_DIR);
      let latest: { id: string; time: number } | null = null;

      for (const session of sessions) {
        const planPath = getPlanPath(session);
        if (existsSync(planPath)) {
          const plan = JSON.parse(readFileSync(planPath, "utf-8")) as Plan;
          if (plan.project_path === projectPath) {
            const stat = statSync(planPath);
            if (!latest || stat.mtimeMs > latest.time) {
              latest = { id: session, time: stat.mtimeMs };
            }
          }
        }
      }

      return latest?.id ?? null;
    },
    catch: (cause) =>
      new FileError({ operation: "find", path: SESSIONS_DIR, cause }),
  });
