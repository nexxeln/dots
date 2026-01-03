/**
 * git-context - get current git context using simple-git
 */

import { tool } from "@opencode-ai/plugin";
import { Effect, pipe } from "effect";
import simpleGit, { type StatusResult } from "simple-git";

class GitContextError {
  readonly _tag = "GitContextError";
  constructor(readonly message: string) {}
}

const getGit = () =>
  Effect.try({
    try: () => simpleGit(),
    catch: () => new GitContextError("Failed to initialize git"),
  });

const getBranch = (git: ReturnType<typeof simpleGit>) =>
  Effect.tryPromise({
    try: () => git.revparse(["--abbrev-ref", "HEAD"]),
    catch: () => new GitContextError("Failed to get branch"),
  }).pipe(Effect.map((b) => b.trim()));

const getStatus = (git: ReturnType<typeof simpleGit>) =>
  Effect.tryPromise({
    try: () => git.status(),
    catch: () => new GitContextError("Failed to get status"),
  });

const getLog = (git: ReturnType<typeof simpleGit>) =>
  Effect.tryPromise({
    try: () => git.log({ maxCount: 5 }),
    catch: () => new GitContextError("Failed to get log"),
  });

const getDiffStat = (git: ReturnType<typeof simpleGit>) =>
  Effect.tryPromise({
    try: () => git.diff(["--stat", "HEAD~1"]),
    catch: () => new GitContextError("No previous commit"),
  }).pipe(Effect.catchAll(() => Effect.succeed("")));

const formatStatus = (status: StatusResult): string => {
  const files = [
    ...status.modified.map((f) => ` M ${f}`),
    ...status.created.map((f) => "?? " + f),
    ...status.deleted.map((f) => ` D ${f}`),
    ...status.renamed.map((r) => `R  ${r.from} -> ${r.to}`),
    ...status.staged.map((f) => `A  ${f}`),
  ];

  if (files.length === 0) return "(clean)";

  const display = files.slice(0, 10).join("\n");
  return files.length > 10 ? `${display}\n... +${files.length - 10} more` : display;
};

const formatSyncStatus = (status: StatusResult): string => {
  const { ahead, behind } = status;

  if (ahead > 0 && behind > 0) return `↑${ahead} ahead, ↓${behind} behind`;
  if (ahead > 0) return `↑${ahead} ahead`;
  if (behind > 0) return `↓${behind} behind`;
  if (status.tracking) return "✓ up to date";
  return "";
};

export default tool({
  description:
    "Get current git context: branch, status, recent commits, diff stats",
  args: {},
  async execute() {
    const program = pipe(
      getGit(),

      Effect.flatMap((git) =>
        Effect.all({
          branch: getBranch(git),
          status: getStatus(git),
          log: getLog(git),
          diff: getDiffStat(git),
        }),
      ),

      Effect.map(({ branch, status, log, diff }) => {
        const syncStatus = formatSyncStatus(status);
        const statusDisplay = formatStatus(status);

        const logDisplay = log.all
          .map((c) => `${c.hash.slice(0, 7)} ${c.message}`)
          .join("\n");

        return `Branch: ${branch}${syncStatus ? ` [${syncStatus}]` : ""}

Status:
${statusDisplay}

Recent commits:
${logDisplay || "No commits"}

Last commit changed:
${diff.trim() || "(no previous commit)"}`;
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? `Git error: ${result.left.message}` : result.right;
  },
});
