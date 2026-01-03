/**
 * swarm messaging tools
 *
 * inter-agent communication via jsonl message files
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe } from "effect";
import { nanoid } from "nanoid";
import { appendMessage, readMessages, readPlan } from "../lib/fs";
import type { Message, MessageType } from "../lib/types";

export const swarm_message_send = tool({
  description:
    "send a message to another swarm agent. used for progress updates, blockers, questions, and completion notifications.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    from: tool.schema
      .string()
      .describe("sender agent id (e.g., 'worker-1', 'orchestrator')"),
    to: tool.schema.string().describe("recipient agent id"),
    type: tool.schema
      .enum([
        "progress",
        "complete",
        "blocker",
        "question",
        "feedback",
        "approved",
        "spawn",
      ])
      .describe("message type"),
    message: tool.schema.string().describe("message content"),
    data: tool.schema
      .string()
      .optional()
      .describe("optional json data payload"),
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

      Effect.flatMap(() => {
        const dataStr = args.data;
        if (dataStr) {
          return Effect.try({
            try: () => JSON.parse(dataStr),
            catch: () => new Error("invalid json in data field"),
          });
        }
        return Effect.succeed(undefined);
      }),

      Effect.flatMap((data) => {
        const message: Message = {
          id: nanoid(8),
          from: args.from,
          to: args.to,
          type: args.type as MessageType,
          message: args.message,
          data,
          timestamp: new Date().toISOString(),
        };

        return pipe(
          appendMessage(args.session_id, args.to, message),
          Effect.map(() => message),
        );
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: result.left.message }, null, 2);
    }

    return JSON.stringify(
      {
        success: true,
        message_id: result.right.id,
        from: result.right.from,
        to: result.right.to,
        type: result.right.type,
      },
      null,
      2,
    );
  },
});

export const swarm_message_inbox = tool({
  description:
    "read messages from an agent's inbox. returns the most recent messages.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    agent_id: tool.schema
      .string()
      .describe("the agent id to read messages for"),
    limit: tool.schema
      .number()
      .optional()
      .describe("max messages to return (default 10)"),
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

      Effect.flatMap(() =>
        readMessages(args.session_id, args.agent_id, args.limit ?? 10),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: result.left.message }, null, 2);
    }

    return JSON.stringify(
      {
        agent_id: args.agent_id,
        messages: result.right,
        count: result.right.length,
      },
      null,
      2,
    );
  },
});

export const swarm_message_wait = tool({
  description:
    "check for new messages of a specific type. useful for workers waiting on reviewer feedback.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    agent_id: tool.schema
      .string()
      .describe("the agent id to check messages for"),
    type: tool.schema
      .enum([
        "progress",
        "complete",
        "blocker",
        "question",
        "feedback",
        "approved",
        "spawn",
      ])
      .describe("message type to filter for"),
    from: tool.schema
      .string()
      .optional()
      .describe("optional: filter by sender"),
  },
  async execute(args) {
    const program = pipe(
      readMessages(args.session_id, args.agent_id, 20),
      Effect.map((messages) => {
        const filtered = messages.filter((m) => {
          if (m.type !== args.type) return false;
          if (args.from && m.from !== args.from) return false;
          return true;
        });
        return filtered;
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: result.left.message }, null, 2);
    }

    const latest = result.right[result.right.length - 1];

    return JSON.stringify(
      {
        found: result.right.length > 0,
        count: result.right.length,
        latest: latest ?? null,
        all: result.right,
      },
      null,
      2,
    );
  },
});

export default swarm_message_send;
