/**
 * swarm_init - initialize a swarm session
 *
 * creates session directory, saves current commit for revert capability
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe } from "effect";
import { nanoid } from "nanoid";
import {
  cleanupOldSessions,
  ensureSessionDir,
  ensureSwarmDirs,
  findActiveSession,
  writePlan,
} from "../lib/fs";
import {
  getCurrentBranch,
  getCurrentCommit,
  getProjectName,
  hasUncommittedChanges,
  isGitRepo,
} from "../lib/git";
import type { Plan } from "../lib/types";

const formatError = (e: unknown): string => {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  if (e && typeof e === "object" && "_tag" in e) return String(e._tag);
  return String(e);
};

export default tool({
  description:
    "initialize a swarm session. saves current git state for potential revert. must be called before other swarm operations.",
  args: {
    task: tool.schema
      .string()
      .describe("the task description for this swarm session"),
    project_path: tool.schema
      .string()
      .optional()
      .describe("project path (defaults to cwd)"),
  },
  async execute(args, _ctx) {
    const projectPath = args.project_path ?? process.cwd();

    const program = pipe(
      isGitRepo(projectPath),
      Effect.flatMap((isRepo) => {
        if (!isRepo) {
          return Effect.fail(new Error("not a git repository. swarm requires git."));
        }
        return Effect.succeed(undefined);
      }),

      Effect.flatMap(() => hasUncommittedChanges(projectPath)),
      Effect.flatMap((hasChanges) => {
        if (hasChanges) {
          return Effect.fail(
            new Error("uncommitted changes detected. please commit or stash before starting swarm."),
          );
        }
        return Effect.succeed(undefined);
      }),

      Effect.flatMap(() => findActiveSession(projectPath)),
      Effect.flatMap((session) => {
        if (session !== null) {
          return Effect.fail(
            new Error(`active swarm session already exists: ${session}. use /swarm-abort to cancel it first.`),
          );
        }
        return Effect.succeed(undefined);
      }),

      Effect.flatMap(() => ensureSwarmDirs()),
      Effect.flatMap(() => cleanupOldSessions()),

      Effect.flatMap(() =>
        Effect.all({
          branch: getCurrentBranch(projectPath),
          commit: getCurrentCommit(projectPath),
          projectName: getProjectName(projectPath),
        }),
      ),

      Effect.flatMap(({ branch, commit, projectName }) => {
        const sessionId = nanoid(10);

        const plan: Plan = {
          session_id: sessionId,
          project_path: projectPath,
          branch,
          start_commit: commit,
          task: args.task,
          created_at: new Date().toISOString(),
          epic: { title: "", description: "" },
          subtasks: [],
        };

        return pipe(
          ensureSessionDir(sessionId),
          Effect.flatMap(() => writePlan(sessionId, plan)),
          Effect.as({
            session_id: sessionId,
            project_path: projectPath,
            project_name: projectName,
            branch,
            start_commit: commit,
            task: args.task,
          }),
        );
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));

    if (result._tag === "Left") {
      return JSON.stringify({ error: formatError(result.left) }, null, 2);
    }

    return JSON.stringify(
      {
        success: true,
        ...result.right,
        message: `swarm session initialized. start commit saved: ${result.right.start_commit.slice(0, 7)}`,
      },
      null,
      2,
    );
  },
});
