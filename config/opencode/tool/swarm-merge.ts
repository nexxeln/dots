/**
 * swarm merge - merge completed task into main worktree
 *
 * cherry-picks commits from task worktrees into main
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe } from "effect";
import { readPlan, readTasks } from "../lib/fs";
import { cherryPickCommit } from "../lib/git";
import type { Plan, TasksState } from "../lib/types";

const formatError = (e: unknown): string => {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  if (e && typeof e === "object" && "_tag" in e) return String(e._tag);
  return String(e);
};

export const swarm_merge_task = tool({
  description:
    "merge a completed task's changes into the main worktree. cherry-picks the commit from the task worktree.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    task_id: tool.schema.string().describe("the task id to merge"),
  },
  async execute(args) {
    const program = pipe(
      Effect.all({
        plan: readPlan(args.session_id),
        tasks: readTasks(args.session_id),
      }),

      Effect.flatMap(({ plan, tasks }): Effect.Effect<{
        plan: Plan;
        tasks: TasksState;
        commit: string;
      }, Error> => {
        if (!plan) {
          return Effect.fail(new Error(`session ${args.session_id} not found`));
        }
        const taskState = tasks[args.task_id];
        if (!taskState) {
          return Effect.fail(new Error(`task ${args.task_id} not found`));
        }
        if (taskState.status !== "complete") {
          return Effect.fail(
            new Error(`task ${args.task_id} is not complete (status: ${taskState.status})`),
          );
        }
        if (!taskState.commit) {
          return Effect.fail(new Error(`task ${args.task_id} has no commit to merge`));
        }
        return Effect.succeed({ plan, tasks, commit: taskState.commit });
      }),

      Effect.flatMap(({ plan, tasks, commit }) =>
        pipe(
          cherryPickCommit(plan.project_path, commit),
          Effect.as({ taskState: tasks[args.task_id], commit }),
        ),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    const { commit } = result.right;
    return JSON.stringify(
      {
        success: true,
        task_id: args.task_id,
        commit,
        message: `merged commit ${commit.slice(0, 7)} into main worktree`,
      },
      null,
      2,
    );
  },
});

export const swarm_merge_all_complete = tool({
  description:
    "merge all completed tasks that haven't been merged yet. orchestrator uses this before finalization.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
  },
  async execute(args) {
    const program = pipe(
      Effect.all({
        plan: readPlan(args.session_id),
        tasks: readTasks(args.session_id),
      }),

      Effect.flatMap(({ plan, tasks }): Effect.Effect<{
        plan: Plan;
        tasks: TasksState;
      }, Error> => {
        if (!plan) {
          return Effect.fail(new Error(`session ${args.session_id} not found`));
        }
        return Effect.succeed({ plan, tasks });
      }),

      Effect.flatMap(({ plan, tasks }) => {
        const completedWithCommits = plan.subtasks
          .filter((s) => {
            const state = tasks[s.id];
            return state?.status === "complete" && state.commit;
          })
          .sort((a, b) => {
            if (a.dependencies.length === 0 && b.dependencies.length > 0) return -1;
            if (b.dependencies.length === 0 && a.dependencies.length > 0) return 1;
            if (a.dependencies.includes(b.id)) return 1;
            if (b.dependencies.includes(a.id)) return -1;
            return 0;
          });

        const merged: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];

        return pipe(
          Effect.forEach(
            completedWithCommits,
            (subtask) => {
              const commit = tasks[subtask.id].commit;
              if (!commit) return Effect.void;
              return pipe(
                cherryPickCommit(plan.project_path, commit),
                Effect.tap(() => Effect.sync(() => merged.push(subtask.id))),
                Effect.catchAll((error) => {
                  failed.push({ id: subtask.id, error: formatError(error) });
                  return Effect.void;
                }),
              );
            },
            { concurrency: 1 },
          ),
          Effect.as({ merged, failed }),
        );
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    return JSON.stringify(
      {
        success: result.right.failed.length === 0,
        session_id: args.session_id,
        merged: result.right.merged,
        merged_count: result.right.merged.length,
        failed: result.right.failed,
        failed_count: result.right.failed.length,
      },
      null,
      2,
    );
  },
});

export default swarm_merge_task;
