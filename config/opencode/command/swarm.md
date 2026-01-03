---
description: start a multi-agent swarm workflow for complex tasks
---

you are starting a swarm workflow for a complex task. this is a multi-phase process where you MUST wait for user input at key points.

## task

$ARGUMENTS

## critical: user interaction points

you MUST stop and wait for user response at these points:
1. **after asking clarifying questions** - wait for answers
2. **after presenting the plan** - wait for approval (y/n/modifications)
3. **if a blocker occurs** - wait for user guidance

do NOT proceed automatically. do NOT answer your own questions.

## phase 1: initialization

1. call `swarm_init` with the task
2. if successful, proceed to clarification

## phase 2: clarification (if needed)

if the task is ambiguous, ask 1-3 focused questions. then STOP and wait for the user to answer.

example:
```
before i create a plan, i have a few questions:

1. should authentication use jwt or sessions?
2. which routes need to be protected?
3. do you need refresh token support?
```

then STOP. do not continue until user responds.

## phase 3: planning

after clarification (or if task is clear):

1. call `swarm_plan_prompt` to get the decomposition prompt
2. respond with the json decomposition
3. call `swarm_plan_validate` to validate
4. present the plan to the user in a readable format
5. ask: "does this plan look good? (y to approve, n to cancel, or describe changes)"
6. STOP and wait for user response

## phase 4: execution (only after user approves)

when user says "y" or "yes" or "approve" or "looks good":

1. call `swarm_worktree_create` for ALL tasks first (create all worktrees upfront)
2. call `swarm_get_ready_tasks` to find tasks with no dependencies
3. for EACH ready task (up to 3), call `swarm_spawn` to get the worker prompt
4. **use the Task tool to spawn workers IN PARALLEL** - make multiple Task calls in a SINGLE response
5. report: "→ spawned N workers in parallel"
6. after workers return, check their results
7. when workers complete, call `swarm_merge_task` for each
8. spawn newly-ready tasks (up to 3 total running)
9. repeat until all complete
10. call `swarm_finalize`

## parallel execution via Task tool

the Task tool is how you spawn parallel workers. when spawning workers:

1. call `swarm_spawn` for each task to get the worker prompt
2. in a SINGLE response, call Task multiple times:

```
Task({
  subagent_type: "worker",
  description: "Execute task-1: create auth utilities",
  prompt: <prompt from swarm_spawn>
})

Task({
  subagent_type: "worker", 
  description: "Execute task-2: create auth middleware",
  prompt: <prompt from swarm_spawn>
})

Task({
  subagent_type: "worker",
  description: "Execute task-3: create protected routes", 
  prompt: <prompt from swarm_spawn>
})
```

this spawns 3 workers in parallel. they run simultaneously and return when done.

## critical: parallel execution

the whole point of swarm is PARALLEL execution. you MUST:
- create ALL worktrees before spawning any workers
- call multiple Task tools in ONE response (this is what enables parallelism)
- not wait for one worker to finish before spawning others

bad (sequential):
```
Task(worker) → wait → Task(worker) → wait → Task(worker)
```

good (parallel - single response with multiple Task calls):
```
[Task(worker-1), Task(worker-2), Task(worker-3)] → all run in parallel
```

## progress updates

report inline as things happen:
- "✓ created 3 worktrees"
- "→ spawning 3 workers in parallel: task-1, task-2, task-3"
- "✓ task-1 complete - merged"
- "→ spawning task-4 (was waiting on task-1)"
- "✓ all tasks complete - finalizing"

## handling user commands during execution

- if user says "abort" or "stop" → call `swarm_abort`
- if user says "status" → call `swarm_status`

## worker-reviewer interaction

workers will internally use the Task tool to invoke the reviewer subagent for code review.
when a worker completes:
- if approved by reviewer, they call `swarm_worker_complete`
- if reviewer rejects 3 times, worker reports failure

you don't need to manage the review process - workers handle it themselves.
