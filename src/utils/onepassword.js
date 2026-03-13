import { execFileSync } from "child_process"

export const DEFAULT_OP_VAULT = process.env.KESSEL_OP_VAULT || "Kessel Boilerplate"

export const SECRET_ITEM_MAP = {
  SUPABASE_SERVICE_ROLE_KEY: "App Runtime",
  SERVICE_ROLE_KEY: "App Runtime",
  SUPABASE_DB_PASSWORD: "App Runtime",
  OPENROUTER_API_KEY: "AI Runtime",
  FAL_API_KEY: "AI Runtime",
  CLERK_SECRET_KEY: "Auth Runtime",
  CLERK_WEBHOOK_SIGNING_SECRET: "Auth Runtime",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "Auth Runtime",
  NEXT_PUBLIC_SPACETIMEDB_URI: "Spacetime Runtime",
  NEXT_PUBLIC_SPACETIMEDB_DATABASE: "Spacetime Runtime",
}

const runOp = (args) =>
  execFileSync("op", args, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  }).trim()

export const ensureOnePasswordCli = () => {
  try {
    runOp(["account", "list", "--format", "json"])
    return true
  } catch {
    return false
  }
}

export const readSecretFromOnePassword = (
  secretName,
  {
    itemTitle = SECRET_ITEM_MAP[secretName] ?? "App Runtime",
    vaultName = DEFAULT_OP_VAULT,
  } = {}
) => runOp(["read", `op://${vaultName}/${itemTitle}/${secretName}`])

export const fetchServiceRoleKeyFromOnePassword = async (debugFn = null) => {
  if (!ensureOnePasswordCli()) {
    debugFn?.("1Password CLI ist nicht angemeldet")
    return null
  }

  try {
    debugFn?.("Lese SERVICE_ROLE_KEY aus 1Password ...")
    const value = readSecretFromOnePassword("SERVICE_ROLE_KEY")
    return value || null
  } catch (error) {
    debugFn?.(`1Password konnte SERVICE_ROLE_KEY nicht liefern: ${error.message}`)
    return null
  }
}

export const fetchDbPasswordFromOnePassword = async (debugFn = null) => {
  if (!ensureOnePasswordCli()) {
    debugFn?.("1Password CLI ist nicht angemeldet")
    return null
  }

  try {
    debugFn?.("Lese SUPABASE_DB_PASSWORD aus 1Password ...")
    const value = readSecretFromOnePassword("SUPABASE_DB_PASSWORD")
    return value || null
  } catch (error) {
    debugFn?.(`1Password konnte SUPABASE_DB_PASSWORD nicht liefern: ${error.message}`)
    return null
  }
}
