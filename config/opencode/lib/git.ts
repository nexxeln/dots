/**
 * swarm git utilities
 *
 * effect-based git operations using simple-git
 */

import { existsSync } from "node:fs";
import { basename } from "node:path";
import { Effect, pipe } from "effect";
import simpleGit, { type SimpleGit } from "simple-git";
import { getWorktreePath, GitError, NotGitRepo, WORKTREES_DIR } from "./types";

const getGit = (cwd: string): Effect.Effect<SimpleGit, GitError> =>
  Effect.try({
    try: () => simpleGit(cwd),
    catch: (cause) => new GitError({ operation: "init", cause }),
  });

export const getCurrentBranch = (cwd: string): Effect.Effect<string, GitError> =>
  pipe(
    getGit(cwd),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: () => git.revparse(["--abbrev-ref", "HEAD"]),
        catch: (cause) => new GitError({ operation: "get-branch", cause }),
      }),
    ),
    Effect.map((branch) => branch.trim()),
  );

export const getCurrentCommit = (cwd: string): Effect.Effect<string, GitError> =>
  pipe(
    getGit(cwd),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: () => git.revparse(["HEAD"]),
        catch: (cause) => new GitError({ operation: "get-commit", cause }),
      }),
    ),
    Effect.map((commit) => commit.trim()),
  );

export const getProjectName = (cwd: string): Effect.Effect<string, never> =>
  Effect.succeed(basename(cwd));

export const isGitRepo = (cwd: string): Effect.Effect<boolean, NotGitRepo | GitError> =>
  pipe(
    getGit(cwd),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: () => git.checkIsRepo(),
        catch: () => new NotGitRepo({ path: cwd }),
      }),
    ),
  );

export const hasUncommittedChanges = (
  cwd: string,
): Effect.Effect<boolean, GitError> =>
  pipe(
    getGit(cwd),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: async () => {
          const status = await git.status();
          return !status.isClean();
        },
        catch: (cause) => new GitError({ operation: "status", cause }),
      }),
    ),
  );

export const createWorktree = (
  mainCwd: string,
  projectName: string,
  taskId: string,
  commit: string,
): Effect.Effect<string, GitError> =>
  pipe(
    getGit(mainCwd),
    Effect.flatMap((git) => {
      const worktreePath = getWorktreePath(projectName, taskId);
      return pipe(
        Effect.tryPromise({
          try: async () => {
            await git.raw(["worktree", "add", "--detach", worktreePath, commit]);
            return worktreePath;
          },
          catch: (cause) => new GitError({ operation: "worktree-add", cause }),
        }),
      );
    }),
  );

export const removeWorktree = (
  mainCwd: string,
  worktreePath: string,
): Effect.Effect<void, GitError> =>
  pipe(
    getGit(mainCwd),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: async () => {
          if (existsSync(worktreePath)) {
            await git.raw(["worktree", "remove", "--force", worktreePath]);
          }
        },
        catch: (cause) => new GitError({ operation: "worktree-remove", cause }),
      }),
    ),
  );

export const listWorktrees = (
  mainCwd: string,
): Effect.Effect<string[], GitError> =>
  pipe(
    getGit(mainCwd),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: async () => {
          const result = await git.raw(["worktree", "list", "--porcelain"]);
          const paths: string[] = [];
          for (const line of result.split("\n")) {
            if (line.startsWith("worktree ")) {
              paths.push(line.replace("worktree ", ""));
            }
          }
          return paths;
        },
        catch: (cause) => new GitError({ operation: "worktree-list", cause }),
      }),
    ),
  );

export const cleanupProjectWorktrees = (
  mainCwd: string,
  projectName: string,
): Effect.Effect<string[], GitError> =>
  pipe(
    listWorktrees(mainCwd),
    Effect.flatMap((worktrees) => {
      const projectWorktrees = worktrees.filter((w) =>
        w.startsWith(`${WORKTREES_DIR}/${projectName}-`),
      );
      return pipe(
        Effect.all(
          projectWorktrees.map((w) => removeWorktree(mainCwd, w)),
          { concurrency: "unbounded" },
        ),
        Effect.as(projectWorktrees),
      );
    }),
  );

export const commitInWorktree = (
  worktreePath: string,
  message: string,
): Effect.Effect<string, GitError> =>
  pipe(
    getGit(worktreePath),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: async () => {
          await git.add(".");
          await git.commit(message);
          const commit = await git.revparse(["HEAD"]);
          return commit.trim();
        },
        catch: (cause) => new GitError({ operation: "commit", cause }),
      }),
    ),
  );

export const cherryPickCommit = (
  targetCwd: string,
  commit: string,
): Effect.Effect<void, GitError> =>
  pipe(
    getGit(targetCwd),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: async () => {
          await git.raw(["cherry-pick", commit]);
        },
        catch: (cause) => new GitError({ operation: "cherry-pick", cause }),
      }),
    ),
  );

export const softReset = (
  cwd: string,
  commit: string,
): Effect.Effect<void, GitError> =>
  pipe(
    getGit(cwd),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: async () => {
          await git.reset(["--soft", commit]);
        },
        catch: (cause) => new GitError({ operation: "soft-reset", cause }),
      }),
    ),
  );

export const hardReset = (
  cwd: string,
  commit: string,
): Effect.Effect<void, GitError> =>
  pipe(
    getGit(cwd),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: async () => {
          await git.reset(["--hard", commit]);
        },
        catch: (cause) => new GitError({ operation: "hard-reset", cause }),
      }),
    ),
  );

export const pullInWorktree = (
  worktreePath: string,
  mainCwd: string,
): Effect.Effect<void, GitError> =>
  pipe(
    Effect.all({ git: getGit(worktreePath), mainCommit: getCurrentCommit(mainCwd) }),
    Effect.flatMap(({ git, mainCommit }) =>
      Effect.tryPromise({
        try: async () => {
          await git.fetch();
          await git.reset(["--hard", mainCommit]);
        },
        catch: (cause) => new GitError({ operation: "pull-worktree", cause }),
      }),
    ),
  );

export const getDiffStats = (
  cwd: string,
  fromCommit: string,
): Effect.Effect<string, GitError> =>
  pipe(
    getGit(cwd),
    Effect.flatMap((git) =>
      Effect.tryPromise({
        try: () => git.diff(["--stat", fromCommit]),
        catch: (cause) => new GitError({ operation: "diff", cause }),
      }),
    ),
  );
