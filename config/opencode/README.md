my custom opencode setup 

## tools

| tool | description |
|------|-------------|
| `git-context` | get current git state - branch, status, recent commits, diff stats |
| `repo_clone` | clone/update a github repo locally |
| `repo_structure` | directory tree with configurable depth |
| `repo_search` | ripgrep search with regex support |
| `repo_ast` | ast-grep structural search |
| `repo_deps` | analyze package.json, requirements.txt, go.mod, Cargo.toml |
| `repo_hotspots` | find most changed files, largest files, TODOs |
| `repo_find` | find files by pattern using fd |
| `repo_exports` | map public API exports |
| `repo_file` | read file contents with optional line range |
| `repo_cleanup` | remove cached repos |
| `swarm_init` | start a swarm session, saves git state |
| `swarm_plan_prompt` | get decomposition prompt |
| `swarm_plan_validate` | validate task breakdown |
| `swarm_worktree_create` | create isolated git worktree for a task |
| `swarm_spawn` | spawn a worker agent |
| `swarm_merge_task` | merge completed task back |
| `swarm_finalize` | finish swarm, soft reset with changes staged |
| `swarm_abort` | abort and revert all changes |

## commands

| command | description |
|---------|-------------|
| `/swarm` | start a multi-agent workflow for complex tasks |
| `/swarm-abort` | abort current swarm and revert all changes |
| `/swarm-status` | check status of running swarm |
| `/graphite` | use graphite cli for stacked PRs |
| `/rmslop` | remove ai-generated code slop |

## knowledge files

| file | description |
|------|-------------|
| `effect.md` | effect-ts patterns and best practices |

## swarm workflow

for complex multi-file changes:

```
/swarm add rate limiting to all api endpoints
```

swarm will:
- break it into parallel tasks
- spawn workers in isolated worktrees
- review each change
- merge everything back
