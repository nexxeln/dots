/**
 * swarm review tools
 *
 * structured feedback from reviewer to worker
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe, Schema } from "effect";
import { nanoid } from "nanoid";
import { appendMessage, readPlan, readTasks, writeTasks } from "../lib/fs";
import {
  MAX_REVIEW_ATTEMPTS,
  type Message,
  type Plan,
  type ReviewFeedback,
  ReviewFeedbackSchema,
  type TasksState,
} from "../lib/types";

const formatError = (e: unknown): string => {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  if (e && typeof e === "object" && "_tag" in e) return String(e._tag);
  return String(e);
};

export const swarm_review_feedback = tool({
  description:
    "send structured review feedback to a worker. reviewer uses this to approve or request changes.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    task_id: tool.schema.string().describe("the task being reviewed"),
    worker_id: tool.schema
      .string()
      .describe("the worker agent id to send feedback to"),
    status: tool.schema
      .enum(["needs_changes", "approved"])
      .describe("review result"),
    issues: tool.schema
      .string()
      .optional()
      .describe("json array of issues if needs_changes"),
    summary: tool.schema
      .string()
      .optional()
      .describe("summary of review (for approved status)"),
  },
  async execute(args) {
    const program = pipe(
      readPlan(args.session_id),

      Effect.flatMap((plan): Effect.Effect<Plan, Error> => {
        if (!plan) {
          return Effect.fail(new Error(`session ${args.session_id} not found`));
        }
        return Effect.succeed(plan);
      }),

      Effect.flatMap(() => {
        const issuesStr = args.issues;
        if (issuesStr) {
          return Effect.try({
            try: () => JSON.parse(issuesStr) as unknown,
            catch: () => new Error("invalid json in issues field"),
          });
        }
        return Effect.succeed(undefined);
      }),

      Effect.flatMap((issues): Effect.Effect<ReviewFeedback, Error> => {
        const feedback = {
          status: args.status,
          issues: issues,
          summary: args.summary,
        };
        return pipe(
          Schema.decodeUnknown(ReviewFeedbackSchema)(feedback),
          Effect.mapError((e) => new Error(`invalid feedback: ${e}`)),
        );
      }),

      Effect.flatMap((feedback) =>
        pipe(
          readTasks(args.session_id),
          Effect.flatMap((tasks): Effect.Effect<{
            feedback: ReviewFeedback;
            attempts: number;
            tasks: TasksState;
          }, Error> => {
            const task = tasks[args.task_id];
            if (!task) {
              return Effect.fail(new Error(`task ${args.task_id} not found`));
            }

            const attempts = (task.review_attempts ?? 0) + 1;

            if (args.status === "needs_changes" && attempts >= MAX_REVIEW_ATTEMPTS) {
              return Effect.fail(
                new Error(
                  `task ${args.task_id} failed after ${MAX_REVIEW_ATTEMPTS} review attempts`,
                ),
              );
            }

            const updated: TasksState = {
              ...tasks,
              [args.task_id]: {
                ...task,
                status: "reviewing",
                review_attempts: attempts,
              },
            };

            return pipe(
              writeTasks(args.session_id, updated),
              Effect.as({ feedback, attempts, tasks: updated }),
            );
          }),
        ),
      ),

      Effect.flatMap(({ feedback, attempts }) => {
        const messageType = args.status === "approved" ? "approved" : "feedback";
        const message: Message = {
          id: nanoid(8),
          from: "reviewer",
          to: args.worker_id,
          type: messageType,
          message:
            args.status === "approved"
              ? `approved: ${feedback.summary ?? "looks good"}`
              : `needs changes (attempt ${attempts}/${MAX_REVIEW_ATTEMPTS}): ${feedback.issues?.length ?? 0} issues found`,
          data: feedback as unknown as Record<string, unknown>,
          timestamp: new Date().toISOString(),
        };

        return pipe(
          appendMessage(args.session_id, args.worker_id, message),
          Effect.as({ feedback, attempts, message }),
        );
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    const { feedback, attempts, message } = result.right;

    return JSON.stringify(
      {
        success: true,
        task_id: args.task_id,
        status: feedback.status,
        review_attempt: attempts,
        max_attempts: MAX_REVIEW_ATTEMPTS,
        message_id: message.id,
        ...(feedback.status === "needs_changes" && {
          issues_count: feedback.issues?.length ?? 0,
          remaining_attempts: MAX_REVIEW_ATTEMPTS - attempts,
        }),
      },
      null,
      2,
    );
  },
});

export default swarm_review_feedback;
