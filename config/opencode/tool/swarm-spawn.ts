/**
 * swarm spawn tools
 *
 * spawn worker agents in their worktrees
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe } from "effect";
import { nanoid } from "nanoid";
import { appendMessage, readPlan, readTasks, writeTasks } from "../lib/fs";
import {
  MAX_PARALLEL_WORKERS,
  type Message,
  type Plan,
  type Subtask,
  type TasksState,
} from "../lib/types";

const formatError = (e: unknown): string => {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  if (e && typeof e === "object" && "_tag" in e) return String(e._tag);
  return String(e);
};

export const swarm_spawn = tool({
  description:
    "spawn a worker agent for a task. creates the spawn message that triggers the worker subagent. orchestrator uses this to start tasks.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    task_id: tool.schema.string().describe("the task id to spawn worker for"),
  },
  async execute(args) {
    const program = pipe(
      readPlan(args.session_id),

      Effect.flatMap((plan): Effect.Effect<{
        plan: Plan;
        task: Subtask;
      }, Error> => {
        if (!plan) {
          return Effect.fail(new Error(`session ${args.session_id} not found`));
        }
        const task = plan.subtasks.find((s) => s.id === args.task_id);
        if (!task) {
          return Effect.fail(new Error(`task ${args.task_id} not found in plan`));
        }
        return Effect.succeed({ plan, task });
      }),

      Effect.flatMap(({ plan, task }) =>
        pipe(
          readTasks(args.session_id),
          Effect.flatMap((tasks): Effect.Effect<{
            plan: Plan;
            task: Subtask;
            tasks: TasksState;
          }, Error> => {
            for (const dep of task.dependencies) {
              const depState = tasks[dep];
              if (!depState || depState.status !== "complete") {
                return Effect.fail(
                  new Error(`cannot spawn ${task.id}: dependency ${dep} not complete`),
                );
              }
            }

            const runningCount = Object.values(tasks).filter(
              (t) => t.status === "running" || t.status === "reviewing",
            ).length;

            if (runningCount >= MAX_PARALLEL_WORKERS) {
              return Effect.fail(
                new Error(
                  `cannot spawn ${task.id}: max parallel workers (${MAX_PARALLEL_WORKERS}) reached`,
                ),
              );
            }

            const taskState = tasks[task.id];
            if (taskState?.status === "running" || taskState?.status === "reviewing") {
              return Effect.fail(new Error(`task ${task.id} is already running`));
            }
            if (taskState?.status === "complete") {
              return Effect.fail(new Error(`task ${task.id} is already complete`));
            }

            return Effect.succeed({ plan, task, tasks });
          }),
        ),
      ),

      Effect.flatMap(({ plan, task, tasks }): Effect.Effect<{
        plan: Plan;
        task: Subtask;
        workerId: string;
        worktreePath: string;
      }, Error> => {
        const workerId = `worker-${task.id}`;
        const worktreePath = tasks[task.id]?.worktree;

        if (!worktreePath) {
          return Effect.fail(
            new Error(`no worktree found for task ${task.id}. create worktree first.`),
          );
        }

        const updated: TasksState = {
          ...tasks,
          [task.id]: {
            ...tasks[task.id],
            status: "running",
            worker_id: workerId,
            started_at: new Date().toISOString(),
          },
        };

        return pipe(
          writeTasks(args.session_id, updated),
          Effect.as({ plan, task, workerId, worktreePath }),
        );
      }),

      Effect.flatMap(({ plan, task, workerId, worktreePath }) => {
        const allSubtasks = plan.subtasks.map((s: Subtask) => ({
          id: s.id,
          title: s.title,
          is_current: s.id === task.id,
        }));

        const spawnData = {
          session_id: args.session_id,
          epic: {
            title: plan.epic.title,
            description: plan.epic.description,
            original_task: plan.task,
          },
          all_subtasks: allSubtasks,
          task_id: task.id,
          task_title: task.title,
          task_description: task.description,
          files: task.files,
          dependencies: task.dependencies,
          worktree_path: worktreePath,
          worker_id: workerId,
        };

        const message: Message = {
          id: nanoid(8),
          from: "orchestrator",
          to: workerId,
          type: "spawn",
          message: `spawn worker for task: ${task.title}`,
          data: spawnData as unknown as Record<string, unknown>,
          timestamp: new Date().toISOString(),
        };

        return pipe(
          appendMessage(args.session_id, workerId, message),
          Effect.as({ task, workerId, worktreePath, spawnData }),
        );
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    const { task, workerId, worktreePath, spawnData } = result.right;

    const workerPrompt = `## epic context

**goal**: ${spawnData.epic.title}
${spawnData.epic.description ? `**description**: ${spawnData.epic.description}` : ""}
**original request**: ${spawnData.epic.original_task}

## all subtasks in this swarm

${spawnData.all_subtasks
  .map(
    (s: { id: string; title: string; is_current: boolean }) =>
      `- ${s.is_current ? "→ " : "  "}${s.id}: ${s.title}${s.is_current ? " (your task)" : ""}`,
  )
  .join("\n")}

## your task

**id**: ${task.id}
**title**: ${task.title}
**description**: ${task.description}
**files to modify**: ${task.files.join(", ")}
**worktree**: ${worktreePath}
${task.dependencies.length > 0 ? `**depends on**: ${task.dependencies.join(", ")} (already complete)` : ""}

## instructions

1. **work in your worktree directory**: ${worktreePath}
2. **implement the task**: create/modify only the files listed above
3. **request review**: when done, you MUST call the reviewer using the Task tool:

\`\`\`
Task({
  subagent_type: "reviewer",
  description: "Review ${task.id}: ${task.title}",
  prompt: "session_id=${args.session_id} task_id=${task.id} worktree=${worktreePath}"
})
\`\`\`

4. **handle feedback**: check your inbox with swarm_message_inbox for reviewer response
   - if "approved": call swarm_worker_complete
   - if "needs_changes": fix issues and request review again (max 3 attempts)

5. **complete**: call swarm_worker_complete with session_id="${args.session_id}" task_id="${task.id}"

DO NOT skip the review step. You MUST invoke the reviewer before completing.`;

    return JSON.stringify(
      {
        success: true,
        task_id: task.id,
        worker_id: workerId,
        worktree_path: worktreePath,
        task_call: {
          subagent_type: "worker",
          description: `Execute ${task.id}: ${task.title}`,
          prompt: workerPrompt,
        },
        message: `worker ${workerId} ready. use Task tool with the task_call fields above.`,
      },
      null,
      2,
    );
  },
});

export const swarm_get_ready_tasks = tool({
  description:
    "get tasks that are ready to be spawned (dependencies satisfied, not running). orchestrator uses this to find work.",
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
        const runningCount = Object.values(tasks).filter(
          (t) => t.status === "running" || t.status === "reviewing",
        ).length;

        const availableSlots = MAX_PARALLEL_WORKERS - runningCount;

        const readyTasks = plan.subtasks.filter((subtask) => {
          const state = tasks[subtask.id];

          if (state?.status && state.status !== "pending") return false;

          if (!state?.worktree) return false;

          const depsComplete = subtask.dependencies.every((dep) => {
            const depState = tasks[dep];
            return depState?.status === "complete";
          });

          return depsComplete;
        });

        return {
          ready: readyTasks,
          running_count: runningCount,
          available_slots: availableSlots,
          can_spawn: Math.min(readyTasks.length, availableSlots),
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
        ready_tasks: result.right.ready.map((t) => ({
          id: t.id,
          title: t.title,
          files: t.files,
        })),
        ready_count: result.right.ready.length,
        running_count: result.right.running_count,
        available_slots: result.right.available_slots,
        can_spawn: result.right.can_spawn,
        max_parallel: MAX_PARALLEL_WORKERS,
      },
      null,
      2,
    );
  },
});

export default swarm_spawn;
