---
description: check the status of the current swarm session
subtask: true
---

check swarm status for the current project.

## instructions

1. find the active swarm session for the current directory
2. call `swarm_status` with the session id
3. display the status in a readable format:
   - epic title
   - overall progress percentage
   - status of each task (pending/running/reviewing/complete/failed)
   - any active workers
   - any blockers

## example output

```
swarm status: add user authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
progress: 66% (2/3 tasks complete)

tasks:
  ✓ task-1: auth utilities (complete)
  ✓ task-2: auth middleware (complete)  
  → task-3: protected routes (running)

workers active: 1
```

if no active session, report that and suggest starting one with `/swarm`.
