/**
 * swarm context - get full context for agents
 *
 * provides epic and task context for workers and reviewers
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe } from "effect";
import { readPlan, readTasks } from "../lib/fs";

export const swarm_get_context = tool({
  description:
    "get full swarm context including epic goal and all subtasks. useful for workers and reviewers to understand the big picture.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    task_id: tool.schema
      .string()
      .optional()
      .describe("specific task to highlight (optional)"),
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

        const subtasksWithStatus = plan.subtasks.map((s) => {
          const state = tasks[s.id];
          return {
            id: s.id,
            title: s.title,
            description: s.description,
            files: s.files,
            dependencies: s.dependencies,
            status: state?.status ?? "pending",
            is_highlighted: args.task_id === s.id,
          };
        });

        const highlightedTask = args.task_id
          ? subtasksWithStatus.find((s) => s.id === args.task_id)
          : null;

        return Effect.succeed({
          session_id: args.session_id,
          epic: {
            title: plan.epic.title,
            description: plan.epic.description,
            original_task: plan.task,
          },
          subtasks: subtasksWithStatus,
          highlighted_task: highlightedTask,
          progress: {
            total: plan.subtasks.length,
            complete: subtasksWithStatus.filter((s) => s.status === "complete")
              .length,
            running: subtasksWithStatus.filter(
              (s) => s.status === "running" || s.status === "reviewing",
            ).length,
            pending: subtasksWithStatus.filter((s) => s.status === "pending")
              .length,
          },
        });
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: result.left.message }, null, 2);
    }

    return JSON.stringify(result.right, null, 2);
  },
});

export const swarm_get_task_for_review = tool({
  description:
    "get full context for reviewing a specific task. includes epic goal, task details, and what to review against.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    task_id: tool.schema.string().describe("the task id being reviewed"),
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

        const task = plan.subtasks.find((s) => s.id === args.task_id);
        if (!task) {
          return Effect.fail(new Error(`task ${args.task_id} not found`));
        }

        const taskState = tasks[args.task_id];
        if (!taskState?.worktree) {
          return Effect.fail(
            new Error(`no worktree found for task ${args.task_id}`),
          );
        }

        const dependentTasks = plan.subtasks.filter((s) =>
          s.dependencies.includes(args.task_id),
        );

        const dependencyTasks = plan.subtasks.filter((s) =>
          task.dependencies.includes(s.id),
        );

        return Effect.succeed({
          session_id: args.session_id,
          epic: {
            title: plan.epic.title,
            description: plan.epic.description,
            original_task: plan.task,
          },
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            files: task.files,
            worktree: taskState.worktree,
            review_attempts: taskState.review_attempts ?? 0,
          },
          review_context: {
            requirements: task.description,
            completed_dependencies: dependencyTasks.map((d) => ({
              id: d.id,
              title: d.title,
              description: d.description,
            })),
            downstream_tasks: dependentTasks.map((d) => ({
              id: d.id,
              title: d.title,
              description: d.description,
            })),
          },
          review_focus: [
            `does the implementation fulfill: "${task.title}"?`,
            `does it align with the epic goal: "${plan.epic.title}"?`,
            dependentTasks.length > 0
              ? `will downstream tasks (${dependentTasks.map((d) => d.id).join(", ")}) be able to use this code?`
              : null,
            dependencyTasks.length > 0
              ? `does it properly integrate with dependencies (${dependencyTasks.map((d) => d.id).join(", ")})?`
              : null,
          ].filter(Boolean),
        });
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: result.left.message }, null, 2);
    }

    return JSON.stringify(result.right, null, 2);
  },
});

export default swarm_get_context;
