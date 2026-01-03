/**
 * swarm complete - mark task as complete
 *
 * worker calls this after reviewer approves
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe } from "effect";
import { nanoid } from "nanoid";
import { appendMessage, readPlan, readTasks, writeTasks } from "../lib/fs";
import { commitInWorktree } from "../lib/git";
import type { Message, Plan, TasksState } from "../lib/types";

const formatError = (e: unknown): string => {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  if (e && typeof e === "object" && "_tag" in e) return String(e._tag);
  return String(e);
};

export const swarm_worker_complete = tool({
  description:
    "mark a task as complete. worker calls this after reviewer approves. commits changes in worktree and notifies orchestrator.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    task_id: tool.schema.string().describe("the task id being completed"),
    summary: tool.schema
      .string()
      .optional()
      .describe("brief summary of what was done"),
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
        const subtask = plan.subtasks.find((s) => s.id === args.task_id);
        const taskState = tasks[args.task_id];
        if (!subtask || !taskState) {
          return Effect.fail(new Error(`task ${args.task_id} not found`));
        }
        if (!taskState.worktree) {
          return Effect.fail(
            new Error(`no worktree found for task ${args.task_id}`),
          );
        }
        return Effect.succeed({
          plan,
          subtask,
          taskState,
          tasks,
          worktree: taskState.worktree,
        });
      }),

      Effect.flatMap(({ plan, subtask, taskState, tasks, worktree }) => {
        const commitMessage = `swarm: ${subtask.title}`;
        return pipe(
          commitInWorktree(worktree, commitMessage),
          Effect.map((commit) => ({
            plan,
            subtask,
            taskState,
            tasks,
            commit: commit as string | null,
          })),
          Effect.catchAll((error) => {
            if (String(error).includes("nothing to commit")) {
              return Effect.succeed({
                plan,
                subtask,
                taskState,
                tasks,
                commit: null as string | null,
              });
            }
            return Effect.fail(error);
          }),
        );
      }),

      Effect.flatMap(({ subtask, taskState, tasks, commit }) => {
        const updated: TasksState = {
          ...tasks,
          [args.task_id]: {
            ...taskState,
            status: "complete",
            completed_at: new Date().toISOString(),
            commit: commit ?? undefined,
          },
        };

        return pipe(
          writeTasks(args.session_id, updated),
          Effect.as({ subtask, commit, workerId: taskState.worker_id }),
        );
      }),

      Effect.flatMap(({ subtask, commit, workerId }) => {
        const message: Message = {
          id: nanoid(8),
          from: workerId ?? `worker-${args.task_id}`,
          to: "orchestrator",
          type: "complete",
          message: args.summary ?? `task ${subtask.title} complete`,
          data: {
            task_id: args.task_id,
            commit: commit,
            summary: args.summary,
          },
          timestamp: new Date().toISOString(),
        };

        return pipe(
          appendMessage(args.session_id, "orchestrator", message),
          Effect.as({ subtask, commit }),
        );
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    const { subtask, commit } = result.right;
    return JSON.stringify(
      {
        success: true,
        task_id: args.task_id,
        task_title: subtask.title,
        commit,
        message: `task "${subtask.title}" marked complete${commit ? ` (commit: ${commit.slice(0, 7)})` : ""}`,
      },
      null,
      2,
    );
  },
});

export const swarm_check_all_complete = tool({
  description:
    "check if all tasks are complete. orchestrator uses this to know when to finalize.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
  },
  async execute(args) {
    const program = pipe(
      Effect.all({
        plan: readPlan(args.session_id),
        tasks: readTasks(args.session_id),
      }),

      Effect.flatMap(
        ({
          plan,
          tasks,
        }): Effect.Effect<
          {
            plan: Plan;
            tasks: TasksState;
          },
          Error
        > => {
          if (!plan) {
            return Effect.fail(
              new Error(`session ${args.session_id} not found`),
            );
          }
          return Effect.succeed({ plan, tasks });
        },
      ),

      Effect.map(({ plan, tasks }) => {
        const completed = plan.subtasks.filter(
          (s) => tasks[s.id]?.status === "complete",
        );
        const failed = plan.subtasks.filter(
          (s) => tasks[s.id]?.status === "failed",
        );
        const running = plan.subtasks.filter(
          (s) =>
            tasks[s.id]?.status === "running" ||
            tasks[s.id]?.status === "reviewing",
        );
        const pending = plan.subtasks.filter(
          (s) => !tasks[s.id]?.status || tasks[s.id]?.status === "pending",
        );

        return {
          total: plan.subtasks.length,
          completed: completed.length,
          failed: failed.length,
          running: running.length,
          pending: pending.length,
          all_complete: completed.length === plan.subtasks.length,
          has_failed: failed.length > 0,
          completed_tasks: completed.map((s) => ({
            id: s.id,
            title: s.title,
            commit: tasks[s.id]?.commit,
          })),
          failed_tasks: failed.map((s) => ({
            id: s.id,
            title: s.title,
            error: tasks[s.id]?.error,
          })),
        };
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    return JSON.stringify(
      {
        session_id: args.session_id,
        ...result.right,
      },
      null,
      2,
    );
  },
});

export default swarm_worker_complete;
