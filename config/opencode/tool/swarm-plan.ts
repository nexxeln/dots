import { tool } from "@opencode-ai/plugin";
import { Effect, pipe, Schema } from "effect";
import { readPlan, writePlan } from "../lib/fs";
import { EpicSchema, type Plan, type Subtask } from "../lib/types";

const DecompositionSubtaskSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  title: Schema.String,
  description: Schema.String,
  files: Schema.Array(Schema.String),
  dependencies: Schema.optional(Schema.Array(Schema.String)),
  complexity: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
});

const DecompositionResponseSchema = Schema.Struct({
  epic: EpicSchema,
  subtasks: Schema.Array(DecompositionSubtaskSchema),
});

function detectFileConflicts(subtasks: Subtask[]): string[] {
  const fileCounts = new Map<string, number>();
  const conflicts: string[] = [];

  for (const subtask of subtasks) {
    for (const file of subtask.files) {
      const count = (fileCounts.get(file) ?? 0) + 1;
      fileCounts.set(file, count);
      if (count === 2) {
        conflicts.push(file);
      }
    }
  }

  return conflicts;
}

function validateDependencies(subtasks: Subtask[]): string[] {
  const errors: string[] = [];
  const ids = new Set(subtasks.map((s) => s.id));

  for (const subtask of subtasks) {
    for (const dep of subtask.dependencies) {
      if (!ids.has(dep)) {
        errors.push(
          `subtask "${subtask.id}" depends on non-existent task "${dep}"`,
        );
      }
      if (dep === subtask.id) {
        errors.push(`subtask "${subtask.id}" depends on itself`);
      }
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(id: string): boolean {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;

    visited.add(id);
    inStack.add(id);

    const subtask = subtasks.find((s) => s.id === id);
    if (subtask) {
      for (const dep of subtask.dependencies) {
        if (hasCycle(dep)) return true;
      }
    }

    inStack.delete(id);
    return false;
  }

  for (const subtask of subtasks) {
    if (hasCycle(subtask.id)) {
      errors.push(`circular dependency detected involving "${subtask.id}"`);
      break;
    }
  }

  return errors;
}

const formatError = (e: unknown): string => {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  if (e && typeof e === "object" && "_tag" in e) return String(e._tag);
  return String(e);
};

export const swarm_plan_prompt = tool({
  description:
    "generate a decomposition prompt for the agent to break down a task into parallelizable subtasks. the agent should respond with json.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    context: tool.schema
      .string()
      .optional()
      .describe("additional context about the codebase or constraints"),
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

      Effect.map((plan) => {
        const contextSection = args.context
          ? `## context\n\n${args.context}\n`
          : "";

        const prompt = `you are decomposing a task into parallelizable subtasks for a swarm of agents.

## task

${plan.task}

${contextSection}

## requirements

1. **break into 2-5 independent subtasks** that can run in parallel where possible
2. **assign files** - each subtask must specify which files it will modify
3. **no file overlap** - files cannot appear in multiple subtasks (they get exclusive locks)
4. **order by dependency** - if subtask b needs subtask a's output, a must come first
5. **estimate complexity** - 1 (trivial) to 5 (complex)

## response format

respond with a json object matching this schema:

\`\`\`json
{
  "epic": {
    "title": "string - overall task title",
    "description": "string - brief description"
  },
  "subtasks": [
    {
      "id": "task-1",
      "title": "what this subtask accomplishes",
      "description": "detailed instructions for the worker agent",
      "files": ["src/file1.ts", "src/file2.ts"],
      "dependencies": [],
      "complexity": 1-5
    }
  ]
}
\`\`\`

## guidelines

- **prefer smaller, focused subtasks** over large complex ones
- **include test files** in the same subtask as the code they test
- **consider shared types** - if multiple files share types, handle that first
- **think about imports** - changes to exported apis affect downstream files
- **be explicit** - spell out what each subtask should do

now decompose the task into subtasks:`;

        return { prompt, plan };
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    return JSON.stringify(
      {
        type: "prompt",
        prompt: result.right.prompt,
        session_id: args.session_id,
        instructions:
          "respond with the json decomposition. then call swarm_plan_validate with your response.",
      },
      null,
      2,
    );
  },
});

export const swarm_plan_validate = tool({
  description:
    "validate and save a task decomposition plan. call this after generating the decomposition json.",
  args: {
    session_id: tool.schema.string().describe("the swarm session id"),
    decomposition_json: tool.schema
      .string()
      .describe("the json decomposition from the agent"),
  },
  async execute(args) {
    const program = pipe(
      Effect.try({
        try: () => JSON.parse(args.decomposition_json),
        catch: () => new Error("invalid json in decomposition"),
      }),

      Effect.flatMap((parsed) =>
        pipe(
          Schema.decodeUnknown(DecompositionResponseSchema)(parsed),
          Effect.mapError((e) => new Error(`invalid decomposition schema: ${e}`)),
        ),
      ),

      Effect.flatMap((decomposition) =>
        pipe(
          readPlan(args.session_id),
          Effect.flatMap((plan): Effect.Effect<{
            decomposition: typeof decomposition;
            plan: Plan;
          }, Error> => {
            if (!plan) {
              return Effect.fail(new Error(`session ${args.session_id} not found`));
            }
            return Effect.succeed({ decomposition, plan });
          }),
        ),
      ),

      Effect.flatMap(({ decomposition, plan }) => {
        const subtasks: Subtask[] = decomposition.subtasks.map((s, i) => ({
          ...s,
          id: s.id ?? `task-${i + 1}`,
          dependencies: s.dependencies ?? [],
        }));

        const fileConflicts = detectFileConflicts(subtasks);
        if (fileConflicts.length > 0) {
          return Effect.fail(
            new Error(
              `file conflicts detected: ${fileConflicts.join(", ")}. each file can only be assigned to one subtask.`,
            ),
          );
        }

        const depErrors = validateDependencies(subtasks);
        if (depErrors.length > 0) {
          return Effect.fail(
            new Error(`dependency errors: ${depErrors.join("; ")}`),
          );
        }

        const updatedPlan: Plan = {
          ...plan,
          epic: decomposition.epic,
          subtasks,
        };

        return pipe(
          writePlan(args.session_id, updatedPlan),
          Effect.as({
            plan: updatedPlan,
            subtask_count: subtasks.length,
            independent_tasks: subtasks.filter((s) => s.dependencies.length === 0).length,
          }),
        );
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    const { plan, subtask_count, independent_tasks } = result.right;

    return JSON.stringify(
      {
        success: true,
        session_id: args.session_id,
        epic: plan.epic,
        subtask_count,
        independent_tasks,
        can_parallelize: Math.min(independent_tasks, 3),
        subtasks: plan.subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          files: s.files,
          dependencies: s.dependencies,
          complexity: s.complexity,
        })),
        message: `plan validated. ${subtask_count} subtasks, ${independent_tasks} can start immediately (max 3 parallel).`,
      },
      null,
      2,
    );
  },
});

export default swarm_plan_prompt;
