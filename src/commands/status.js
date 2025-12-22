import chalk from "chalk"
import { renderStatusTable } from "../ui/sections.js"
import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { loadConfig } from "../config.js"

/**
 * Prüft ob ein Tool installiert ist
 * @param {string} command - Command-Name
 * @returns {boolean}
 */
function isInstalled(command) {
  try {
    execSync(`${command} --version`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/**
 * Ruft Version eines Tools ab
 * @param {string} command - Command-Name
 * @returns {string|null}
 */
function getVersion(command) {
  try {
    const output = execSync(`${command} --version`, { encoding: "utf-8", stdio: "pipe" })
    return output.trim().split("\n")[0]
  } catch {
    return null
  }
}

/**
 * Ruft GitHub User ab
 * @returns {string|null}
 */
function getGitHubUser() {
  try {
    const output = execSync("gh api user", { encoding: "utf-8", stdio: "pipe" })
    const user = JSON.parse(output)
    return user.login
  } catch {
    return null
  }
}

/**
 * Status Command - Zeigt Status-Dashboard
 */
export async function runStatusCommand() {
  const projectName = path.basename(process.cwd())
  const config = loadConfig()
  
  console.log(chalk.cyan.bold(`
  ╭─────────────────────────────────────────────────╮
  │  KESSEL STATUS  (${projectName.padEnd(20)})     │
  ╰─────────────────────────────────────────────────╯
  `))

  // INFRASTRUCTURE
  const infrastructureItems = []
  
  if (isInstalled("gh")) {
    const user = getGitHubUser()
    infrastructureItems.push({
      name: "GitHub CLI",
      status: user ? "ok" : "warning",
      detail: user ? `logged in as ${user}` : "not authenticated",
    })
  } else {
    infrastructureItems.push({
      name: "GitHub CLI",
      status: "error",
      detail: "not installed",
    })
  }
  
  if (isInstalled("supabase")) {
    const version = getVersion("supabase")
    infrastructureItems.push({
      name: "Supabase CLI",
      status: "ok",
      detail: version || "installed",
    })
  } else {
    infrastructureItems.push({
      name: "Supabase CLI",
      status: "error",
      detail: "not installed",
    })
  }
  
  if (isInstalled("vercel")) {
    infrastructureItems.push({
      name: "Vercel CLI",
      status: "ok",
      detail: getVersion("vercel") || "installed",
    })
  } else {
    infrastructureItems.push({
      name: "Vercel CLI",
      status: "warning",
      detail: "not installed (optional)",
    })
  }
  
  if (isInstalled("pnpm")) {
    infrastructureItems.push({
      name: "pnpm",
      status: "ok",
      detail: getVersion("pnpm") || "installed",
    })
  } else {
    infrastructureItems.push({
      name: "pnpm",
      status: "warning",
      detail: "not installed",
    })
  }
  
  renderStatusTable("INFRASTRUCTURE", infrastructureItems)

  // DATABASE
  const dbItems = []
  
  try {
    const infraResponse = await fetch(`${config.infraDb.url}/rest/v1/`, {
      method: "GET",
      headers: { apikey: "test" },
    })
    dbItems.push({
      name: "INFRA-DB",
      status: infraResponse.status === 401 || infraResponse.status === 200 ? "ok" : "warning",
      detail: config.infraDb.projectRef,
    })
  } catch {
    dbItems.push({
      name: "INFRA-DB",
      status: "error",
      detail: "not reachable",
    })
  }
  
  try {
    const devResponse = await fetch(`${config.devDb.url}/rest/v1/`, {
      method: "GET",
      headers: { apikey: "test" },
    })
    dbItems.push({
      name: "DEV-DB",
      status: devResponse.status === 401 || devResponse.status === 200 ? "ok" : "warning",
      detail: config.devDb.projectRef,
    })
  } catch {
    dbItems.push({
      name: "DEV-DB",
      status: "error",
      detail: "not reachable",
    })
  }
  
  renderStatusTable("DATABASE", dbItems)

  // SECRETS
  const secretsItems = []
  const envPath = path.join(process.cwd(), ".env")
  const envLocalPath = path.join(process.cwd(), ".env.local")
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8")
    if (envContent.includes("SERVICE_ROLE_KEY")) {
      secretsItems.push({
        name: "SERVICE_ROLE_KEY",
        status: "ok",
        detail: "in .env",
      })
    } else {
      secretsItems.push({
        name: "SERVICE_ROLE_KEY",
        status: "warning",
        detail: "missing in .env",
      })
    }
  } else {
    secretsItems.push({
      name: "SERVICE_ROLE_KEY",
      status: "error",
      detail: ".env not found",
    })
  }
  
  if (fs.existsSync(envLocalPath)) {
    const envLocalContent = fs.readFileSync(envLocalPath, "utf-8")
    if (envLocalContent.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) {
      secretsItems.push({
        name: "ANON_KEY",
        status: "ok",
        detail: "in .env.local",
      })
    } else {
      secretsItems.push({
        name: "ANON_KEY",
        status: "warning",
        detail: "missing in .env.local",
      })
    }
  } else {
    secretsItems.push({
      name: "ANON_KEY",
      status: "error",
      detail: ".env.local not found",
    })
  }
  
  renderStatusTable("SECRETS", secretsItems)

  // MCP
  const mcpItems = []
  const mcpConfigPath = path.join(process.cwd(), ".cursor", "mcp.json")
  
  if (fs.existsSync(mcpConfigPath)) {
    try {
      const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"))
      const supabaseMCPs = Object.keys(mcpConfig.mcpServers || {})
        .filter(key => key.toLowerCase().includes("supabase"))
      
      if (supabaseMCPs.length > 0) {
        mcpItems.push({
          name: "MCP config",
          status: "ok",
          detail: `${supabaseMCPs.length} Supabase MCP(s)`,
        })
      } else {
        mcpItems.push({
          name: "MCP config",
          status: "warning",
          detail: "no Supabase MCP configured",
        })
      }
    } catch {
      mcpItems.push({
        name: "MCP config",
        status: "error",
        detail: "invalid JSON",
      })
    }
  } else {
    mcpItems.push({
      name: "MCP config",
      status: "warning",
      detail: ".cursor/mcp.json not found",
    })
  }
  
  renderStatusTable("MCP / INTEGRATIONS", mcpItems)
  
  console.log("\n")
}

