/**
 * swarm abort - stop swarm and revert all changes
 *
 * hard resets to start commit, cleans up all worktrees and temp files
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe } from "effect";
import {
  deleteSessionFiles,
  readPlan,
  readTasks,
  writeFailure,
} from "../lib/fs";
import { cleanupProjectWorktrees, getProjectName, hardReset } from "../lib/git";
import type { Failure } from "../lib/types";

export const swarm_abort = tool({
  description:
    "abort the swarm and revert all changes. hard resets to the start commit and cleans up all worktrees.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    reason: tool.schema.string().optional().describe("reason for aborting"),
    failed_task: tool.schema
      .string()
      .optional()
      .describe("task id that caused the failure"),
    error: tool.schema.string().optional().describe("error message if failure"),
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
        return Effect.succeed({ plan, tasks });
      }),

      Effect.flatMap(({ plan, tasks }) =>
        pipe(
          getProjectName(plan.project_path),
          Effect.map((projectName) => ({ plan, tasks, projectName })),
        ),
      ),

      Effect.flatMap(({ plan, tasks, projectName }) =>
        pipe(
          cleanupProjectWorktrees(plan.project_path, projectName),
          Effect.map((removed) => ({ plan, tasks, removedWorktrees: removed })),
          Effect.catchAll(() =>
            Effect.succeed({ plan, tasks, removedWorktrees: [] as string[] }),
          ),
        ),
      ),

      Effect.flatMap(({ plan, tasks, removedWorktrees }) =>
        pipe(
          hardReset(plan.project_path, plan.start_commit),
          Effect.map(() => ({ plan, tasks, removedWorktrees })),
        ),
      ),

      Effect.flatMap(({ plan, tasks, removedWorktrees }) => {
        const completedTasks = Object.entries(tasks)
          .filter(([_, state]) => state.status === "complete")
          .map(([id]) => id);
        const pendingTasks = Object.entries(tasks)
          .filter(
            ([_, state]) =>
              state.status === "pending" || state.status === "running",
          )
          .map(([id]) => id);

        const failure: Failure = {
          failed_task: args.failed_task ?? "unknown",
          error: args.error ?? args.reason ?? "aborted by user",
          attempt: 1,
          completed_tasks: completedTasks,
          pending_tasks: pendingTasks,
          timestamp: new Date().toISOString(),
        };

        return pipe(
          writeFailure(args.session_id, failure),
          Effect.map(() => ({ plan, failure, removedWorktrees })),
        );
      }),

      Effect.flatMap(({ plan, failure, removedWorktrees }) =>
        pipe(
          deleteSessionFiles(args.session_id, true),
          Effect.map(() => ({ plan, failure, removedWorktrees })),
        ),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: result.left.message }, null, 2);
    }

    const { plan, failure, removedWorktrees } = result.right;

    return JSON.stringify(
      {
        success: true,
        session_id: args.session_id,
        reverted_to: plan.start_commit.slice(0, 7),
        removed_worktrees: removedWorktrees.length,
        completed_before_abort: failure.completed_tasks,
        reason: failure.error,
        retry_options: {
          same_plan: `/swarm --retry`,
          edit_plan: `/swarm --retry --edit`,
          fresh_start: `/swarm "${plan.task}"`,
        },
        message: `swarm aborted. reverted to commit ${plan.start_commit.slice(0, 7)}. ${removedWorktrees.length} worktrees cleaned up.`,
      },
      null,
      2,
    );
  },
});

export default swarm_abort;
