import { execSync } from "child_process"

/**
 * Lade GitHub Token aus GitHub CLI (gh auth token)
 * @returns {string|null} GitHub Token oder null
 */
export function loadGitHubToken() {
  try {
    const token = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim()
    if (token && token.length > 0) {
      return token
    }
  } catch (error) {
    // GitHub CLI nicht verfügbar oder nicht authentifiziert
    return null
  }
  return null
}

