/**
 * swarm plugin - event hooks for cleanup and session management
 */

import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, readdirSync, statSync, rmSync, readFileSync } from "node:fs"
import { SESSIONS_DIR, WORKTREES_DIR, SESSION_TTL_DAYS } from "../lib/types"

/**
 * cleanup old sessions (older than SESSION_TTL_DAYS)
 */
function cleanupOldSessions(): string[] {
  if (!existsSync(SESSIONS_DIR)) return []

  const now = Date.now()
  const ttlMs = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  const deleted: string[] = []

  try {
    const sessions = readdirSync(SESSIONS_DIR)
    for (const session of sessions) {
      const sessionDir = `${SESSIONS_DIR}/${session}`
      try {
        const stat = statSync(sessionDir)
        if (now - stat.mtimeMs > ttlMs) {
          rmSync(sessionDir, { recursive: true, force: true })
          deleted.push(session)
        }
      } catch {}
    }
  } catch {}

  return deleted
}

/**
 * cleanup orphaned worktrees (worktrees without active sessions)
 */
function cleanupOrphanedWorktrees(): string[] {
  if (!existsSync(WORKTREES_DIR)) return []

  const deleted: string[] = []

  try {
    const worktrees = readdirSync(WORKTREES_DIR)
    
    // get active session project names
    const activeSessions = new Set<string>()
    if (existsSync(SESSIONS_DIR)) {
      const sessions = readdirSync(SESSIONS_DIR)
      for (const session of sessions) {
        const planPath = `${SESSIONS_DIR}/${session}/plan.json`
        if (existsSync(planPath)) {
          try {
            const plan = JSON.parse(readFileSync(planPath, "utf-8"))
            const projectName = plan.project_path.split("/").pop()
            activeSessions.add(projectName)
          } catch {}
        }
      }
    }

    // remove worktrees for projects without active sessions
    for (const worktree of worktrees) {
      // worktree format: {projectName}-{taskId}
      const projectName = worktree.replace(/-task-\d+$/, "").replace(/-[^-]+$/, "")
      if (!activeSessions.has(projectName)) {
        const worktreePath = `${WORKTREES_DIR}/${worktree}`
        try {
          rmSync(worktreePath, { recursive: true, force: true })
          deleted.push(worktree)
        } catch {}
      }
    }
  } catch {}

  return deleted
}

export const SwarmPlugin: Plugin = async () => {
  const deletedSessions = cleanupOldSessions()
  const deletedWorktrees = cleanupOrphanedWorktrees()

  if (deletedSessions.length > 0 || deletedWorktrees.length > 0) {
    console.log(
      `[swarm] cleanup: ${deletedSessions.length} old sessions, ${deletedWorktrees.length} orphaned worktrees`,
    )
  }

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        cleanupOldSessions()
      }
    },
  }
}

export default SwarmPlugin
