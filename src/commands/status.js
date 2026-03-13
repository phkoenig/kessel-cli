import chalk from "chalk"
import { renderStatusTable } from "../ui/sections.js"
import { execSync } from "child_process"
import fs from "fs"
import path from "path"

function isInstalled(command) {
  try { execSync(`${command} --version`, { stdio: "pipe" }); return true } catch { return false }
}

function getVersion(command) {
  try { return execSync(`${command} --version`, { encoding: "utf-8", stdio: "pipe" }).trim().split("\n")[0] } catch { return null }
}

function getGitHubUser() {
  try { return JSON.parse(execSync("gh api user", { encoding: "utf-8", stdio: "pipe" })).login } catch { return null }
}

/**
 * Status Command - Zeigt Status-Dashboard
 * Boilerplate 3.0 Architektur: Supabase + Clerk + SpacetimeDB
 */
export async function runStatusCommand() {
  const projectName = path.basename(process.cwd())
  
  console.log(chalk.cyan.bold(`
  ╭─────────────────────────────────────────────────╮
  │  KESSEL STATUS  (${projectName.padEnd(20)})     │
  ╰─────────────────────────────────────────────────╯
  `))

  // TOOLS
  const toolItems = []
  
  if (isInstalled("gh")) {
    const user = getGitHubUser()
    toolItems.push({ name: "GitHub CLI", status: user ? "ok" : "warning", detail: user ? `logged in as ${user}` : "not authenticated" })
  } else {
    toolItems.push({ name: "GitHub CLI", status: "error", detail: "not installed" })
  }
  
  toolItems.push(isInstalled("supabase")
    ? { name: "Supabase CLI", status: "ok", detail: getVersion("supabase") || "installed" }
    : { name: "Supabase CLI", status: "error", detail: "not installed" })
  
  toolItems.push(isInstalled("pnpm")
    ? { name: "pnpm", status: "ok", detail: getVersion("pnpm") || "installed" }
    : { name: "pnpm", status: "warning", detail: "not installed" })

  // SpacetimeDB
  try {
    const stVersion = execSync("spacetime version", { encoding: "utf-8", stdio: "pipe" }).trim()
    toolItems.push({ name: "SpacetimeDB CLI", status: "ok", detail: stVersion })
  } catch {
    toolItems.push({ name: "SpacetimeDB CLI", status: "warning", detail: "not installed (optional)" })
  }

  toolItems.push(isInstalled("vercel")
    ? { name: "Vercel CLI", status: "ok", detail: getVersion("vercel") || "installed" }
    : { name: "Vercel CLI", status: "warning", detail: "not installed (optional)" })
  
  renderStatusTable("TOOLS", toolItems)

  // SERVICES
  const serviceItems = []
  const envLocalPath = path.join(process.cwd(), ".env.local")
  
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, "utf-8")
    
    // Supabase
    const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
    if (supabaseUrl) {
      try {
        const ref = new URL(supabaseUrl).hostname.split(".")[0]
        const response = await fetch(`${supabaseUrl}/rest/v1/`, { method: "GET", headers: { apikey: "test" } })
        serviceItems.push({ name: "Supabase", status: response.status === 401 || response.status === 200 ? "ok" : "warning", detail: ref })
      } catch {
        serviceItems.push({ name: "Supabase", status: "error", detail: "not reachable" })
      }
    } else {
      serviceItems.push({ name: "Supabase", status: "warning", detail: "URL not configured" })
    }

    // Clerk
    const clerkKey = envContent.match(/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim()
    serviceItems.push(clerkKey
      ? { name: "Clerk", status: "ok", detail: `${clerkKey.substring(0, 15)}...` }
      : { name: "Clerk", status: "warning", detail: "not configured (run pnpm pull-env)" })

    // SpacetimeDB
    const stDb = envContent.match(/NEXT_PUBLIC_SPACETIMEDB_DATABASE=(.+)/)?.[1]?.trim()
    serviceItems.push(stDb
      ? { name: "SpacetimeDB", status: "ok", detail: stDb }
      : { name: "SpacetimeDB", status: "warning", detail: "not configured" })
  } else {
    serviceItems.push({ name: ".env.local", status: "error", detail: "not found" })
  }
  
  renderStatusTable("SERVICES", serviceItems)

  // MCP
  const mcpItems = []
  const mcpConfigPath = path.join(process.cwd(), ".cursor", "mcp.json")
  
  if (fs.existsSync(mcpConfigPath)) {
    try {
      const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"))
      const supabaseMCPs = Object.keys(mcpConfig.mcpServers || {}).filter(k => k.toLowerCase().includes("supabase"))
      mcpItems.push(supabaseMCPs.length > 0
        ? { name: "Supabase MCP", status: "ok", detail: supabaseMCPs.join(", ") }
        : { name: "Supabase MCP", status: "warning", detail: "not configured" })
    } catch {
      mcpItems.push({ name: "MCP config", status: "error", detail: "invalid JSON" })
    }
  } else {
    mcpItems.push({ name: "MCP config", status: "warning", detail: ".cursor/mcp.json not found" })
  }
  
  renderStatusTable("MCP / INTEGRATIONS", mcpItems)
  console.log("\n")
}
