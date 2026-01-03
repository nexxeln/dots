---
description: abort the current swarm and revert all changes
subtask: true
---

abort the active swarm session and revert all changes.

## instructions

1. find the active swarm session for the current directory
2. confirm with user: "are you sure you want to abort? all changes will be reverted. (y/n)"
3. if confirmed, call `swarm_abort` with the session id
4. report what was reverted and cleanup done
5. offer retry options

## example flow

```
user: /swarm-abort

assistant: 
found active swarm session: "add user authentication"
- 2/3 tasks complete
- 1 task running

are you sure you want to abort? all changes will be reverted. (y/n)

user: y

assistant:
swarm aborted.
- reverted to commit abc1234
- cleaned up 3 worktrees
- session files removed

to retry with the same plan: /swarm --retry
to modify the plan first: /swarm --retry --edit
```

if no active session, report that.
