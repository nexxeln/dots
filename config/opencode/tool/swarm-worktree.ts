/**
 * swarm worktree management
 *
 * create, list, and cleanup git worktrees for isolated task execution
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe } from "effect";
import { readPlan, readTasks, writeTasks } from "../lib/fs";
import {
  cleanupProjectWorktrees,
  createWorktree,
  getProjectName,
  listWorktrees,
  removeWorktree,
} from "../lib/git";
import { type TasksState, WORKTREES_DIR } from "../lib/types";

export const swarm_worktree_create = tool({
  description:
    "create a git worktree for a task. the worktree is an isolated copy of the repo for the worker to modify.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    task_id: tool.schema
      .string()
      .describe("the task id to create worktree for"),
  },
  async execute(args) {
    const program = pipe(
      readPlan(args.session_id),
      Effect.flatMap((plan) => {
        if (!plan) {
          return Effect.fail(new Error(`session ${args.session_id} not found`));
        }
        const task = plan.subtasks.find((s) => s.id === args.task_id);
        if (!task) {
          return Effect.fail(
            new Error(`task ${args.task_id} not found in plan`),
          );
        }
        return Effect.succeed({ plan, task });
      }),

      Effect.flatMap(({ plan, task }) =>
        pipe(
          getProjectName(plan.project_path),
          Effect.map((projectName) => ({ plan, task, projectName })),
        ),
      ),

      Effect.flatMap(({ plan, task, projectName }) =>
        pipe(
          createWorktree(
            plan.project_path,
            projectName,
            task.id,
            plan.start_commit,
          ),
          Effect.map((worktreePath) => ({ plan, task, worktreePath })),
        ),
      ),

      Effect.flatMap(({ task, worktreePath }) =>
        pipe(
          readTasks(args.session_id),
          Effect.flatMap((tasks) => {
            const updated: TasksState = {
              ...tasks,
              [task.id]: {
                ...tasks[task.id],
                status: "pending",
                worktree: worktreePath,
                review_attempts: 0,
              },
            };
            return writeTasks(args.session_id, updated);
          }),
          Effect.map(() => ({ task, worktreePath })),
        ),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: result.left.message }, null, 2);
    }

    return JSON.stringify(
      {
        success: true,
        task_id: result.right.task.id,
        worktree_path: result.right.worktreePath,
        message: `worktree created at ${result.right.worktreePath}`,
      },
      null,
      2,
    );
  },
});

export const swarm_worktree_remove = tool({
  description:
    "remove a git worktree. called after task completion or on abort.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    task_id: tool.schema
      .string()
      .describe("the task id whose worktree to remove"),
  },
  async execute(args) {
    const program = pipe(
      Effect.all({
        plan: readPlan(args.session_id),
        tasks: readTasks(args.session_id),
      }),
      Effect.flatMap(({ plan, tasks }) => {
        if (!plan) {
          return Effect.fail(new Error(`session ${args.session_id} not found`));
        }
        const taskState = tasks[args.task_id];
        if (!taskState?.worktree) {
          return Effect.fail(
            new Error(`no worktree found for task ${args.task_id}`),
          );
        }
        return Effect.succeed({
          plan,
          taskState,
          worktreePath: taskState.worktree,
        });
      }),

      Effect.flatMap(({ plan, worktreePath }) =>
        pipe(
          removeWorktree(plan.project_path, worktreePath),
          Effect.map(() => worktreePath),
        ),
      ),

      Effect.flatMap((worktreePath) =>
        pipe(
          readTasks(args.session_id),
          Effect.flatMap((tasks) => {
            const updated: TasksState = {
              ...tasks,
              [args.task_id]: {
                ...tasks[args.task_id],
                worktree: undefined,
              },
            };
            return writeTasks(args.session_id, updated);
          }),
          Effect.map(() => worktreePath),
        ),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: result.left.message }, null, 2);
    }

    return JSON.stringify(
      {
        success: true,
        task_id: args.task_id,
        removed_path: result.right,
      },
      null,
      2,
    );
  },
});

export const swarm_worktree_list = tool({
  description: "list all worktrees for a session",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
  },
  async execute(args) {
    const program = pipe(
      readPlan(args.session_id),
      Effect.flatMap((plan) => {
        if (!plan) {
          return Effect.fail(new Error(`session ${args.session_id} not found`));
        }
        return Effect.succeed(plan);
      }),
      Effect.flatMap((plan) =>
        pipe(
          Effect.all({
            projectName: getProjectName(plan.project_path),
            allWorktrees: listWorktrees(plan.project_path),
          }),
          Effect.map(({ projectName, allWorktrees }) => ({
            plan,
            worktrees: allWorktrees.filter((w) =>
              w.startsWith(`${WORKTREES_DIR}/${projectName}-`),
            ),
          })),
        ),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: result.left.message }, null, 2);
    }

    return JSON.stringify(
      {
        session_id: args.session_id,
        worktrees: result.right.worktrees,
        count: result.right.worktrees.length,
      },
      null,
      2,
    );
  },
});

export const swarm_worktree_cleanup = tool({
  description:
    "remove all worktrees for a session. used during abort or finalization.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
  },
  async execute(args) {
    const program = pipe(
      readPlan(args.session_id),
      Effect.flatMap((plan) => {
        if (!plan) {
          return Effect.fail(new Error(`session ${args.session_id} not found`));
        }
        return Effect.succeed(plan);
      }),
      Effect.flatMap((plan) =>
        pipe(
          getProjectName(plan.project_path),
          Effect.flatMap((projectName) =>
            cleanupProjectWorktrees(plan.project_path, projectName),
          ),
        ),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: result.left.message }, null, 2);
    }

    return JSON.stringify(
      {
        success: true,
        session_id: args.session_id,
        removed: result.right,
        count: result.right.length,
      },
      null,
      2,
    );
  },
});

export default swarm_worktree_create;
