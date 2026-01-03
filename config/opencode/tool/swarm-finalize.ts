/**
 * swarm finalize - complete successful swarm execution
 *
 * soft resets to leave changes uncommitted, cleans up everything
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe } from "effect";
import { deleteSessionFiles, readPlan, readTasks } from "../lib/fs";
import {
  cleanupProjectWorktrees,
  getDiffStats,
  getProjectName,
  softReset,
} from "../lib/git";
import type { Plan, TasksState } from "../lib/types";

const formatError = (e: unknown): string => {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  if (e && typeof e === "object" && "_tag" in e) return String(e._tag);
  return String(e);
};

export const swarm_finalize = tool({
  description:
    "finalize a successful swarm. soft resets to start commit (leaving changes staged), cleans up all worktrees and session files.",
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

        const incomplete = plan.subtasks.filter((s) => {
          const state = tasks[s.id];
          return state?.status !== "complete";
        });

        if (incomplete.length > 0) {
          return Effect.fail(
            new Error(
              `cannot finalize: ${incomplete.length} tasks not complete: ${incomplete.map((s) => s.id).join(", ")}`,
            ),
          );
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
          softReset(plan.project_path, plan.start_commit),
          Effect.as({ plan, tasks, removedWorktrees }),
        ),
      ),

      Effect.flatMap(({ plan, tasks, removedWorktrees }) =>
        pipe(
          getDiffStats(plan.project_path, "HEAD"),
          Effect.map((diffStats) => ({ plan, tasks, removedWorktrees, diffStats })),
          Effect.catchAll(() =>
            Effect.succeed({ plan, tasks, removedWorktrees, diffStats: "" }),
          ),
        ),
      ),

      Effect.flatMap(({ plan, tasks, removedWorktrees, diffStats }) =>
        pipe(
          deleteSessionFiles(args.session_id, false),
          Effect.as({ plan, tasks, removedWorktrees, diffStats }),
        ),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    const { plan, tasks, removedWorktrees, diffStats } = result.right;

    const completedTasks = plan.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      commit: tasks[s.id]?.commit?.slice(0, 7),
    }));

    return JSON.stringify(
      {
        success: true,
        session_id: args.session_id,
        epic: plan.epic.title,
        completed_tasks: completedTasks,
        task_count: completedTasks.length,
        removed_worktrees: removedWorktrees.length,
        changes_staged: true,
        diff_stats: diffStats || "(run `git diff --staged` to see changes)",
        next_steps: [
          "review changes with `git diff --staged`",
          'commit when ready: `git commit -m "your message"`',
          "or discard with `git reset --hard HEAD`",
        ],
        message: `swarm complete! ${completedTasks.length} tasks finished. all changes are staged (uncommitted) for your review.`,
      },
      null,
      2,
    );
  },
});

export const swarm_status = tool({
  description: "get the current status of a swarm session",
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

      Effect.map(({ plan, tasks }) => {
        const statusCounts = {
          pending: 0,
          running: 0,
          reviewing: 0,
          complete: 0,
          failed: 0,
          cancelled: 0,
        };

        const taskDetails = plan.subtasks.map((s) => {
          const state = tasks[s.id];
          const status = state?.status ?? "pending";
          statusCounts[status]++;
          return {
            id: s.id,
            title: s.title,
            status,
            worker: state?.worker_id,
            review_attempts: state?.review_attempts ?? 0,
            commit: state?.commit?.slice(0, 7),
          };
        });

        const progress = Math.round(
          (statusCounts.complete / plan.subtasks.length) * 100,
        );

        return {
          session_id: args.session_id,
          epic: plan.epic.title,
          task: plan.task,
          branch: plan.branch,
          start_commit: plan.start_commit.slice(0, 7),
          progress: `${progress}%`,
          counts: statusCounts,
          tasks: taskDetails,
          is_complete: statusCounts.complete === plan.subtasks.length,
          has_failures: statusCounts.failed > 0,
        };
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    return JSON.stringify(result.right, null, 2);
  },
});

export default swarm_finalize;
