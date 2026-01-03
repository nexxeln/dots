/**
 * repo-explorer - tools for exploring and analyzing GitHub repositories
 *
 * clones repos locally and provides search, structure, and analysis capabilities
 * uses simple-git for git operations
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { $ } from "bun";
import { Effect, pipe } from "effect";
import simpleGit from "simple-git";

const EXPLORER_DIR = join(process.env.HOME || "~", ".opencode-repos");
const MAX_OUTPUT = 30000;

const truncateOutput = (output: string, max = MAX_OUTPUT): string =>
  output.length <= max ? output : `${output.slice(0, max)}\n\n... (truncated)`;
const CACHE_TTL_MS = 5 * 60 * 1000;
const lastFetchTime = new Map<string, number>();

interface ParsedRepo {
  owner: string;
  repo: string;
  url: string;
}

interface RepoResult {
  path: string;
  owner: string;
  repo: string;
  cached: boolean;
}

class RepoError {
  readonly _tag = "RepoError";
  constructor(readonly message: string) {}
}

const parseRepoUrl = (input: string): Effect.Effect<ParsedRepo, RepoError> =>
  pipe(
    Effect.sync(() => {
      let owner: string;
      let repo: string;

      if (input.includes("git@")) {
        const match = input.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
        if (!match) return null;
        owner = match[1];
        repo = match[2];
      } else {
        const match = input.match(
          /(?:(?:https?:\/\/)?github\.com\/)?([^/]+)\/([^/\s]+)/i,
        );
        if (!match) return null;
        owner = match[1];
        repo = match[2].replace(/\.git$/, "");
      }

      return { owner, repo, url: `https://github.com/${owner}/${repo}.git` };
    }),
    Effect.flatMap((result) =>
      result
        ? Effect.succeed(result)
        : Effect.fail(
            new RepoError("Invalid repo format. Use: owner/repo or GitHub URL"),
          ),
    ),
  );

const runShell = (
  cmd: ReturnType<typeof $>,
): Effect.Effect<string, RepoError> =>
  Effect.tryPromise({
    try: () => cmd.quiet().text(),
    catch: (e) => new RepoError(`Command failed: ${e}`),
  });

const runShellSafe = (
  cmd: ReturnType<typeof $>,
): Effect.Effect<string, never> =>
  pipe(
    runShell(cmd),
    Effect.catchAll(() => Effect.succeed("")),
  );

const cloneRepo = (
  url: string,
  targetPath: string,
): Effect.Effect<void, RepoError> =>
  Effect.tryPromise({
    try: async () => {
      const git = simpleGit();
      await git.clone(url, targetPath, ["--depth", "100"]);
    },
    catch: (e) => new RepoError(`Clone failed: ${e}`),
  });

const fetchAndReset = (repoPath: string): Effect.Effect<void, RepoError> =>
  Effect.tryPromise({
    try: async () => {
      const git = simpleGit(repoPath);
      await git.fetch(["--all", "--prune"]);
      await git.reset(["--hard", "origin/HEAD"]);
    },
    catch: (e) => new RepoError(`Fetch/reset failed: ${e}`),
  });

const getRecentCommits = (
  repoPath: string,
  count: number,
): Effect.Effect<string, never> =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        const git = simpleGit(repoPath);
        const log = await git.log({ maxCount: count });
        return log.all
          .map((c) => `${c.hash.slice(0, 7)} ${c.message}`)
          .join("\n");
      },
      catch: () => new RepoError("Failed to get log"),
    }),
    Effect.catchAll(() => Effect.succeed("")),
  );

const getChurnStats = (repoPath: string): Effect.Effect<string, never> =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        const git = simpleGit(repoPath);
        const log = await git.log(["--name-only", "--pretty=format:", "-100"]);

        const fileCounts = new Map<string, number>();
        for (const commit of log.all) {
          const diff = commit.diff;
          if (diff?.files) {
            for (const file of diff.files) {
              fileCounts.set(file.file, (fileCounts.get(file.file) || 0) + 1);
            }
          }
        }

        // Fallback to raw parsing if diff is empty
        if (fileCounts.size === 0) {
          const raw = await git.raw([
            "log",
            "--oneline",
            "--name-only",
            "--pretty=format:",
            "-100",
          ]);
          for (const line of raw.split("\n")) {
            const file = line.trim();
            if (file) {
              fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
            }
          }
        }

        return [...fileCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([file, count]) => `${count.toString().padStart(6)} ${file}`)
          .join("\n");
      },
      catch: () => new RepoError("Failed to get churn"),
    }),
    Effect.catchAll(() => Effect.succeed("")),
  );

const ensureRepo = (
  repoInput: string,
  forceRefresh = false,
): Effect.Effect<RepoResult, RepoError> =>
  pipe(
    parseRepoUrl(repoInput),

    Effect.flatMap(({ owner, repo, url }) => {
      const repoPath = join(EXPLORER_DIR, owner, repo);
      const cacheKey = `${owner}/${repo}`;
      const ownerDir = join(EXPLORER_DIR, owner);

      return pipe(
        Effect.sync(() => {
          if (!existsSync(ownerDir)) {
            mkdirSync(ownerDir, { recursive: true });
          }
        }),

        Effect.flatMap(() => {
          if (existsSync(repoPath)) {
            const lastFetch = lastFetchTime.get(cacheKey) || 0;
            const timeSinceLastFetch = Date.now() - lastFetch;

            if (!forceRefresh && timeSinceLastFetch < CACHE_TTL_MS) {
              return Effect.succeed({
                path: repoPath,
                owner,
                repo,
                cached: true,
              });
            }

            return pipe(
              fetchAndReset(repoPath),
              Effect.tap(() =>
                Effect.sync(() => lastFetchTime.set(cacheKey, Date.now())),
              ),
              Effect.map(() => ({
                path: repoPath,
                owner,
                repo,
                cached: false,
              })),
              Effect.catchAll(() =>
                pipe(
                  Effect.sync(() =>
                    rmSync(repoPath, { recursive: true, force: true }),
                  ),
                  Effect.flatMap(() => cloneRepo(url, repoPath)),
                  Effect.tap(() =>
                    Effect.sync(() => lastFetchTime.set(cacheKey, Date.now())),
                  ),
                  Effect.map(() => ({
                    path: repoPath,
                    owner,
                    repo,
                    cached: false,
                  })),
                ),
              ),
            );
          }

          return pipe(
            cloneRepo(url, repoPath),
            Effect.tap(() =>
              Effect.sync(() => lastFetchTime.set(cacheKey, Date.now())),
            ),
            Effect.map(() => ({ path: repoPath, owner, repo, cached: false })),
          );
        }),
      );
    }),
  );

const formatError = (e: unknown): string => {
  if (e instanceof RepoError) return e.message;
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  return String(e);
};

export const repo_clone = tool({
  description:
    "Clone/update a GitHub repo locally for analysis. Returns the local path and available tools.",
  args: {
    repo: tool.schema.string().describe("GitHub repo (owner/repo or URL)"),
    refresh: tool.schema
      .boolean()
      .optional()
      .describe("Force refresh even if cached"),
  },
  async execute({ repo, refresh = false }) {
    const program = pipe(
      ensureRepo(repo, refresh),

      Effect.flatMap((result) =>
        pipe(
          Effect.all({
            fileCount: runShellSafe(
              $`find ${result.path} -type f -not -path '*/.git/*' | wc -l`,
            ),
            languages: runShellSafe(
              $`find ${result.path} -type f -not -path '*/.git/*' | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -10`,
            ),
          }),
          Effect.map(({ fileCount, languages }) => ({
            result,
            fileCount: fileCount.trim(),
            languages: languages.trim(),
          })),
        ),
      ),

      Effect.map(({ result, fileCount, languages }) => {
        const cacheStatus = result.cached ? "(cached)" : "(fetched)";
        return `Repo ready at: ${result.path} ${cacheStatus}

Files: ${fileCount}

Top extensions:
${languages}

Available tools:
- repo_structure - directory tree
- repo_search - ripgrep search
- repo_ast - ast-grep patterns
- repo_deps - dependency analysis
- repo_hotspots - find complex/changed files
- repo_exports - map public API
- repo_file - read file contents
- repo_find - find files by pattern`;
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? formatError(result.left) : result.right;
  },
});

export const repo_structure = tool({
  description: "Get directory structure of a cloned repo",
  args: {
    repo: tool.schema.string().describe("GitHub repo (owner/repo or URL)"),
    path: tool.schema.string().optional().describe("Subpath to explore"),
    depth: tool.schema.number().optional().describe("Max depth (default: 4)"),
  },
  async execute({ repo, path = "", depth = 4 }) {
    const program = pipe(
      ensureRepo(repo),

      Effect.flatMap((result) => {
        const targetPath = path ? join(result.path, path) : result.path;
        return runShellSafe(
          $`tree -L ${depth} --dirsfirst -I '.git|node_modules|__pycache__|.venv|dist|build|.next' ${targetPath} 2>/dev/null || find ${targetPath} -maxdepth ${depth} -not -path '*/.git/*' -not -path '*/node_modules/*' | head -200`,
        );
      }),

      Effect.map((output) => output.trim() || "No structure found"),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? formatError(result.left) : result.right;
  },
});

export const repo_search = tool({
  description: "Search in a cloned repo using ripgrep",
  args: {
    repo: tool.schema.string().describe("GitHub repo (owner/repo or URL)"),
    pattern: tool.schema.string().describe("Regex pattern to search"),
    fileGlob: tool.schema
      .string()
      .optional()
      .describe("File glob filter (e.g., '*.ts')"),
    context: tool.schema
      .number()
      .optional()
      .describe("Lines of context (default: 2)"),
    maxResults: tool.schema
      .number()
      .optional()
      .describe("Max results (default: 50)"),
  },
  async execute({ repo, pattern, fileGlob, context = 2, maxResults = 50 }) {
    const program = pipe(
      ensureRepo(repo),

      Effect.flatMap((result) => {
        const globArg = fileGlob ? `--glob '${fileGlob}'` : "";
        const cmd = `rg '${pattern}' ${result.path} -C ${context} ${globArg} --max-count ${maxResults} -n --color never 2>/dev/null | head -500`;
        return runShellSafe($`sh -c ${cmd}`);
      }),

      Effect.map((output) =>
        truncateOutput(output.trim() || "No matches found"),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? formatError(result.left) : result.right;
  },
});

export const repo_ast = tool({
  description: "AST-grep structural search in a cloned repo",
  args: {
    repo: tool.schema.string().describe("GitHub repo (owner/repo or URL)"),
    pattern: tool.schema
      .string()
      .describe(
        "ast-grep pattern (e.g., 'function $NAME($$$ARGS) { $$$BODY }')",
      ),
    lang: tool.schema
      .string()
      .optional()
      .describe("Language: ts, tsx, js, py, go, rust (default: auto)"),
  },
  async execute({ repo, pattern, lang }) {
    const program = pipe(
      ensureRepo(repo),

      Effect.flatMap((result) => {
        const langArg = lang ? `--lang ${lang}` : "";
        return runShellSafe(
          $`ast-grep --pattern ${pattern} ${langArg} ${result.path} 2>/dev/null | head -200`,
        );
      }),

      Effect.map((output) => output.trim() || "No matches found"),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? formatError(result.left) : result.right;
  },
});

export const repo_deps = tool({
  description: "Analyze dependencies in a cloned repo",
  args: {
    repo: tool.schema.string().describe("GitHub repo (owner/repo or URL)"),
  },
  async execute({ repo }) {
    const program = pipe(
      ensureRepo(repo),

      Effect.flatMap((result) =>
        Effect.sync(() => {
          const outputs: string[] = [];

          const pkgPath = join(result.path, "package.json");
          if (existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
              const deps = Object.keys(pkg.dependencies || {}).slice(0, 20);
              const devDeps = Object.keys(pkg.devDependencies || {}).slice(
                0,
                15,
              );

              outputs.push(`## Node.js (package.json)

Dependencies (${Object.keys(pkg.dependencies || {}).length}):
${deps.join(", ")}${Object.keys(pkg.dependencies || {}).length > 20 ? " ..." : ""}

DevDependencies (${Object.keys(pkg.devDependencies || {}).length}):
${devDeps.join(", ")}${Object.keys(pkg.devDependencies || {}).length > 15 ? " ..." : ""}`);
            } catch {}
          }

          const requirementsPath = join(result.path, "requirements.txt");
          const pyprojectPath = join(result.path, "pyproject.toml");

          if (existsSync(requirementsPath)) {
            try {
              const reqs = readFileSync(requirementsPath, "utf-8");
              const deps = reqs
                .split("\n")
                .filter((l: string) => l.trim() && !l.startsWith("#"))
                .slice(0, 20);
              outputs.push(`## Python (requirements.txt)\n${deps.join("\n")}`);
            } catch {}
          } else if (existsSync(pyprojectPath)) {
            try {
              const content = readFileSync(pyprojectPath, "utf-8");
              outputs.push(
                `## Python (pyproject.toml)\n${content.slice(0, 1500)}...`,
              );
            } catch {}
          }

          const goModPath = join(result.path, "go.mod");
          if (existsSync(goModPath)) {
            try {
              const content = readFileSync(goModPath, "utf-8");
              outputs.push(`## Go (go.mod)\n${content.slice(0, 1500)}`);
            } catch {}
          }

          const cargoPath = join(result.path, "Cargo.toml");
          if (existsSync(cargoPath)) {
            try {
              const content = readFileSync(cargoPath, "utf-8");
              outputs.push(`## Rust (Cargo.toml)\n${content.slice(0, 1500)}`);
            } catch {}
          }

          return outputs.length
            ? outputs.join("\n\n")
            : "No dependency files found";
        }),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? formatError(result.left) : result.right;
  },
});

export const repo_hotspots = tool({
  description: "Find code hotspots - most changed files, largest files, TODOs",
  args: {
    repo: tool.schema.string().describe("GitHub repo (owner/repo or URL)"),
  },
  async execute({ repo }) {
    const program = pipe(
      ensureRepo(repo),

      Effect.flatMap((result) =>
        Effect.all({
          churn: getChurnStats(result.path),
          largest: runShellSafe(
            $`fd -t f -E .git -E node_modules -E __pycache__ . ${result.path} --exec wc -l {} 2>/dev/null | sort -rn | head -15`,
          ),
          todos: runShellSafe(
            $`rg -c 'TODO|FIXME|HACK|XXX' ${result.path} --glob '!.git' 2>/dev/null | sort -t: -k2 -rn | head -10`,
          ),
          recent: getRecentCommits(result.path, 20),
        }),
      ),

      Effect.map(({ churn, largest, todos, recent }) => {
        const outputs: string[] = [];

        if (churn.trim()) {
          outputs.push(`## Most Changed Files (Git Churn)\n${churn.trim()}`);
        }
        if (largest.trim()) {
          outputs.push(`## Largest Files (by lines)\n${largest.trim()}`);
        }
        if (todos.trim()) {
          outputs.push(`## Most TODOs/FIXMEs\n${todos.trim()}`);
        }
        if (recent.trim()) {
          outputs.push(`## Recent Commits\n${recent.trim()}`);
        }

        return truncateOutput(outputs.join("\n\n") || "No hotspots found");
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? formatError(result.left) : result.right;
  },
});

export const repo_find = tool({
  description: "Find files by pattern using fd",
  args: {
    repo: tool.schema.string().describe("GitHub repo (owner/repo or URL)"),
    pattern: tool.schema.string().describe("File name pattern (regex)"),
    type: tool.schema
      .enum(["f", "d", "l", "x"])
      .optional()
      .describe("Type: f=file, d=dir, l=symlink, x=executable"),
    extension: tool.schema
      .string()
      .optional()
      .describe("Filter by extension (e.g., 'ts')"),
  },
  async execute({ repo, pattern, type, extension }) {
    const program = pipe(
      ensureRepo(repo),

      Effect.flatMap((result) => {
        const typeArg = type ? `-t ${type}` : "";
        const extArg = extension ? `-e ${extension}` : "";
        return runShellSafe(
          $`fd ${pattern} ${result.path} ${typeArg} ${extArg} -E .git -E node_modules 2>/dev/null | head -50`,
        );
      }),

      Effect.map((output) => output.trim() || "No matches"),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? formatError(result.left) : result.right;
  },
});

export const repo_exports = tool({
  description: "Map public API - find all exports in a repo",
  args: {
    repo: tool.schema.string().describe("GitHub repo (owner/repo or URL)"),
    entryPoint: tool.schema
      .string()
      .optional()
      .describe("Entry point to analyze (e.g., 'src/index.ts')"),
  },
  async execute({ repo, entryPoint }) {
    const program = pipe(
      ensureRepo(repo),

      Effect.flatMap((result) => {
        let entry = entryPoint;

        if (!entry) {
          const possibleEntries = [
            "src/index.ts",
            "src/index.tsx",
            "src/index.js",
            "lib/index.ts",
            "lib/index.js",
            "index.ts",
            "index.js",
            "src/main.ts",
            "src/main.js",
            "mod.ts",
          ];

          for (const e of possibleEntries) {
            if (existsSync(join(result.path, e))) {
              entry = e;
              break;
            }
          }
        }

        return pipe(
          Effect.all({
            named: runShellSafe(
              $`rg "^export (const|function|class|type|interface|enum|let|var) " ${result.path} --glob '*.ts' --glob '*.tsx' --glob '*.js' -o -N 2>/dev/null | sort | uniq -c | sort -rn | head -30`,
            ),
            defaults: runShellSafe(
              $`rg "^export default" ${result.path} --glob '*.ts' --glob '*.tsx' --glob '*.js' -l 2>/dev/null | head -20`,
            ),
            reexports: runShellSafe(
              $`rg "^export \\* from|^export \\{[^}]+\\} from" ${result.path} --glob '*.ts' --glob '*.tsx' --glob '*.js' 2>/dev/null | head -30`,
            ),
          }),
          Effect.map(({ named, defaults, reexports }) => ({
            result,
            entry,
            named,
            defaults,
            reexports,
          })),
        );
      }),

      Effect.flatMap(({ result, entry, named, defaults, reexports }) =>
        Effect.sync(() => {
          const outputs: string[] = [];

          if (entry) {
            const entryPath = join(result.path, entry);
            if (existsSync(entryPath)) {
              try {
                const content = readFileSync(entryPath, "utf-8");
                outputs.push(
                  `## Entry Point: ${entry}\n\`\`\`typescript\n${content.slice(0, 2000)}${content.length > 2000 ? "\n// ... truncated" : ""}\n\`\`\``,
                );
              } catch {}
            }
          }

          if (named.trim()) {
            outputs.push(`## Named Exports\n${named.trim()}`);
          }
          if (defaults.trim()) {
            outputs.push(`## Files with Default Exports\n${defaults.trim()}`);
          }
          if (reexports.trim()) {
            outputs.push(`## Re-exports\n${reexports.trim()}`);
          }

          return truncateOutput(outputs.join("\n\n") || "No exports found");
        }),
      ),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? formatError(result.left) : result.right;
  },
});

export const repo_file = tool({
  description: "Read a file from a cloned repo",
  args: {
    repo: tool.schema.string().describe("GitHub repo (owner/repo or URL)"),
    path: tool.schema.string().describe("File path within repo"),
    startLine: tool.schema
      .number()
      .optional()
      .describe("Start line (1-indexed)"),
    endLine: tool.schema.number().optional().describe("End line"),
  },
  async execute({ repo, path, startLine, endLine }) {
    const program = pipe(
      ensureRepo(repo),

      Effect.flatMap((result) => {
        const filePath = join(result.path, path);

        if (!existsSync(filePath)) {
          return Effect.fail(new RepoError(`File not found: ${path}`));
        }

        return Effect.try({
          try: () => {
            const content = readFileSync(filePath, "utf-8");
            const lines = content.split("\n");

            if (startLine || endLine) {
              const start = (startLine || 1) - 1;
              const end = endLine || lines.length;
              const slice = lines.slice(start, end);
              return slice
                .map((l: string, i: number) => `${start + i + 1}: ${l}`)
                .join("\n");
            }

            if (lines.length > 500) {
              return `${lines
                .slice(0, 500)
                .map((l: string, i: number) => `${i + 1}: ${l}`)
                .join("\n")}\n\n... (${lines.length - 500} more lines)`;
            }

            return lines
              .map((l: string, i: number) => `${i + 1}: ${l}`)
              .join("\n");
          },
          catch: (e) => new RepoError(`Failed to read file: ${e}`),
        });
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? formatError(result.left) : result.right;
  },
});

export const repo_cleanup = tool({
  description: "Remove a cloned repo from local cache",
  args: {
    repo: tool.schema
      .string()
      .describe("GitHub repo (owner/repo or URL) or 'all' to clear everything"),
  },
  async execute({ repo }) {
    if (repo === "all") {
      return pipe(
        Effect.sync(() => {
          rmSync(EXPLORER_DIR, { recursive: true, force: true });
          return `Cleared all repos from ${EXPLORER_DIR}`;
        }),
        Effect.runSync,
      );
    }

    const program = pipe(
      parseRepoUrl(repo),

      Effect.flatMap(({ owner, repo: repoName }) => {
        const repoPath = join(EXPLORER_DIR, owner, repoName);
        if (!existsSync(repoPath)) {
          return Effect.succeed("Repo not in cache");
        }
        return Effect.sync(() => {
          rmSync(repoPath, { recursive: true, force: true });
          return `Removed: ${repoPath}`;
        });
      }),
    );

    const result = await Effect.runPromise(Effect.either(program));
    return result._tag === "Left" ? formatError(result.left) : result.right;
  },
});

export default repo_clone;
