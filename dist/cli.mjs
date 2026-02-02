#!/usr/bin/env node
import React5, { useState, useEffect } from 'react';
import { render, Box, Text, useStdin, useApp } from 'ink';
import Spinner2 from 'ink-spinner';
import fs6 from 'fs';
import path6 from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import chalk11 from 'chalk';
import { execSync, spawn } from 'child_process';
import pg from 'pg';
import enquirer from 'enquirer';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import inquirer from 'inquirer';
import { createClient } from '@supabase/supabase-js';
import { Listr } from 'listr2';
import { Octokit } from 'octokit';
import degit from 'degit';
import { program } from 'commander';

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
function Banner() {
  return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React5.createElement(Text, { bold: true, color: "cyan" }, "  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557"), /* @__PURE__ */ React5.createElement(Text, { bold: true, color: "cyan" }, "  \u2551     \u{1F680} KESSEL CLI v2.1.0            \u2551"), /* @__PURE__ */ React5.createElement(Text, { bold: true, color: "cyan" }, "  \u2551     B2B App Boilerplate Generator   \u2551"), /* @__PURE__ */ React5.createElement(Text, { bold: true, color: "cyan" }, "  \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D"));
}
var init_Banner = __esm({
  "src/components/Banner.jsx"() {
  }
});
function PhaseHeader({ phase, title, progress }) {
  const progressBarWidth = 30;
  const filled = Math.round(progress / 100 * progressBarWidth);
  const empty = progressBarWidth - filled;
  const progressBar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  const progressStr = `${progress}%`.padStart(4);
  const titlePadding = 30 - title.length;
  return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column", marginTop: 1, marginBottom: 1 }, /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, `  \u2554\u2550\u2550\u2550 PHASE ${phase}: ${title} ${"\u2550".repeat(titlePadding)}\u2557`), /* @__PURE__ */ React5.createElement(Text, { color: "cyan" }, `  \u2551 ${progressBar} ${progressStr} \u2551`), /* @__PURE__ */ React5.createElement(Text, { color: "cyan" }, `  \u255A${"\u2550".repeat(45)}\u255D`));
}
var init_PhaseHeader = __esm({
  "src/components/PhaseHeader.jsx"() {
  }
});
function TaskList({ tasks, ctx, setCtx, verbose, onComplete, onError }) {
  const [taskStates, setTaskStates] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [debugLogs, setDebugLogs] = useState([]);
  const debug = verbose ? (message) => {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().split("T")[1].split(".")[0];
    setDebugLogs((prev) => [...prev.slice(-10), `[${timestamp}] ${message}`]);
  } : () => {
  };
  useEffect(() => {
    if (tasks.length === 0) {
      return;
    }
    const executeTasks = async () => {
      for (let i = 0; i < tasks.length; i++) {
        const taskDef = tasks[i];
        debug(`\u25B6 Start: ${taskDef.title}`);
        if (taskDef.skip && typeof taskDef.skip === "function" && taskDef.skip()) {
          debug(`\u23ED \xDCbersprungen: ${taskDef.title}`);
          setTaskStates((prev) => ({
            ...prev,
            [i]: { status: "skipped", message: "\xFCbersprungen" }
          }));
          continue;
        }
        setTaskStates((prev) => ({
          ...prev,
          [i]: { status: "running" }
        }));
        setCurrentIndex(i);
        try {
          const mockTask = {
            title: taskDef.title,
            output: "",
            skip: () => false,
            debug
            // Debug-Funktion an Task übergeben
          };
          const taskCtx = { ...ctx, debug };
          debug(`\u2699 Ausf\xFChrung: ${taskDef.title}`);
          const startTime = Date.now();
          await taskDef.task(taskCtx, mockTask);
          const duration = Date.now() - startTime;
          debug(`\u2713 Fertig: ${taskDef.title} (${duration}ms)`);
          setCtx((prevCtx) => ({ ...prevCtx, ...taskCtx }));
          setTaskStates((prev) => ({
            ...prev,
            [i]: { status: "completed" }
          }));
        } catch (error) {
          debug(`\u2717 Fehler: ${taskDef.title} - ${error.message}`);
          setTaskStates((prev) => ({
            ...prev,
            [i]: { status: "error", error: error.message }
          }));
          if (onError) {
            onError(error);
          }
          return;
        }
      }
      if (onComplete) {
        onComplete();
      }
    };
    executeTasks();
  }, [tasks]);
  return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, tasks.map((taskDef, index) => {
    const state = taskStates[index];
    if (!state) {
      return null;
    }
    if (state.status === "skipped") {
      return /* @__PURE__ */ React5.createElement(Text, { key: index, dimColor: true }, `  \u23ED  ${taskDef.title} (${state.message})`);
    }
    if (state.status === "running") {
      return /* @__PURE__ */ React5.createElement(Box, { key: index, flexDirection: "row" }, /* @__PURE__ */ React5.createElement(Text, { color: "cyan" }, `  \u23F3 ${taskDef.title}...`), /* @__PURE__ */ React5.createElement(Spinner2, { type: "dots" }));
    }
    if (state.status === "completed") {
      return /* @__PURE__ */ React5.createElement(Text, { key: index, color: "green" }, `  \u2713 ${taskDef.title}`);
    }
    if (state.status === "error") {
      return /* @__PURE__ */ React5.createElement(Box, { key: index, flexDirection: "column" }, /* @__PURE__ */ React5.createElement(Text, { color: "red" }, `  \u2717 ${taskDef.title}`), /* @__PURE__ */ React5.createElement(Text, { color: "red" }, `    Fehler: ${state.error}`));
    }
    return null;
  }), verbose && debugLogs.length > 0 && /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column", marginTop: 1, borderStyle: "single", borderColor: "gray", paddingX: 1 }, /* @__PURE__ */ React5.createElement(Text, { color: "gray", bold: true }, "\u{1F50D} Debug-Log:"), debugLogs.map((log, i) => /* @__PURE__ */ React5.createElement(Text, { key: i, color: "gray", dimColor: true }, log))));
}
var init_TaskList = __esm({
  "src/components/TaskList.jsx"() {
  }
});
function WizardProgress({ currentStep, totalSteps, stepTitle }) {
  const progress = Math.round((currentStep + 1) / totalSteps * 100);
  const progressBarWidth = 20;
  const filled = Math.round(progress / 100 * progressBarWidth);
  const empty = progressBarWidth - filled;
  const progressBar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React5.createElement(Box, null, /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "Schritt ", currentStep + 1, "/", totalSteps), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, " - "), /* @__PURE__ */ React5.createElement(Text, { color: "white" }, stepTitle)), /* @__PURE__ */ React5.createElement(Box, null, /* @__PURE__ */ React5.createElement(Text, { color: "cyan" }, progressBar), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, " ", progress, "%")));
}
var init_WizardProgress = __esm({
  "src/components/WizardProgress.jsx"() {
  }
});
function normalizeUsername(username) {
  if (!username || typeof username !== "string") {
    throw new Error("Username muss ein nicht-leerer String sein");
  }
  return username.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
}
function getProfileDir() {
  const homeDir = os.homedir();
  return path6.join(homeDir, ".kessel");
}
function getProfilePath(username) {
  const normalized = normalizeUsername(username);
  const profileDir = getProfileDir();
  if (!fs6.existsSync(profileDir)) {
    fs6.mkdirSync(profileDir, { recursive: true, mode: 448 });
  }
  return path6.join(profileDir, `${normalized}.kesselprofile`);
}
function loadProfile(username) {
  if (!username || typeof username !== "string") {
    return null;
  }
  try {
    const profilePath = getProfilePath(username);
    if (!fs6.existsSync(profilePath)) {
      return null;
    }
    const content = fs6.readFileSync(profilePath, "utf-8");
    const profile = {};
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        const unquotedValue = value.replace(/^["']|["']$/g, "");
        profile[key] = unquotedValue;
      }
    }
    return Object.keys(profile).length > 0 ? profile : null;
  } catch (error) {
    return null;
  }
}
var init_profile = __esm({
  "lib/profile.js"() {
  }
});

// src/config.js
var config_exports = {};
__export(config_exports, {
  BOILERPLATE_ENV_PATH: () => BOILERPLATE_ENV_PATH,
  DEFAULTS: () => DEFAULTS,
  loadConfig: () => loadConfig,
  loadServiceRoleKey: () => loadServiceRoleKey
});
function loadConfig() {
  const configPath = path6.join(__dirname$1, "..", "config.json");
  if (fs6.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs6.readFileSync(configPath, "utf-8"));
      return {
        ...config,
        // Legacy-Kompatibilität: defaultSupabaseUrl zeigt auf INFRA-DB (Vault)
        defaultSupabaseUrl: config.infraDb?.url || DEFAULTS.infraDb.url,
        // Legacy-Kompatibilität: sharedSupabaseProject = INFRA-DB
        sharedSupabaseProject: {
          url: config.infraDb?.url || DEFAULTS.infraDb.url,
          projectRef: config.infraDb?.projectRef || DEFAULTS.infraDb.projectRef
        }
      };
    } catch (error) {
      console.warn(chalk11.yellow("\u26A0\uFE0F  Konfigurationsdatei konnte nicht geladen werden, verwende Standardwerte"));
    }
  }
  return {
    ...DEFAULTS,
    // Legacy-Kompatibilität
    defaultSupabaseUrl: DEFAULTS.infraDb.url,
    sharedSupabaseProject: {
      url: DEFAULTS.infraDb.url,
      projectRef: DEFAULTS.infraDb.projectRef
    }
  };
}
function loadServiceRoleKey() {
  if (fs6.existsSync(BOILERPLATE_ENV_PATH)) {
    try {
      const envContent = fs6.readFileSync(BOILERPLATE_ENV_PATH, "utf-8");
      const match = envContent.match(/SERVICE_ROLE_KEY=(.+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch (error) {
      console.error(chalk11.red(`\u274C Fehler beim Lesen der .env Datei: ${error.message}`));
      return null;
    }
  } else {
    console.error(chalk11.red(`\u274C .env Datei nicht gefunden: ${BOILERPLATE_ENV_PATH}`));
    return null;
  }
  return null;
}
var __filename$1, __dirname$1, BOILERPLATE_ENV_PATH, DEFAULTS;
var init_config = __esm({
  "src/config.js"() {
    __filename$1 = fileURLToPath(import.meta.url);
    __dirname$1 = path6.dirname(__filename$1);
    BOILERPLATE_ENV_PATH = "B:/Nextcloud/CODE/proj/kessel-boilerplate/.env";
    DEFAULTS = {
      infraDb: {
        name: "Kessel",
        url: "https://ufqlocxqizmiaozkashi.supabase.co",
        projectRef: "ufqlocxqizmiaozkashi",
        description: "INFRA-DB: User, Auth, Vault, Multi-Tenant Schemas"
      },
      devDb: {
        name: "MEGABRAIN",
        url: "https://jpmhwyjiuodsvjowddsm.supabase.co",
        projectRef: "jpmhwyjiuodsvjowddsm",
        description: "DEV-DB: App-Daten, Entwicklung"
      },
      defaultTemplateRepo: "phkoenig/kessel-boilerplate"
    };
  }
});
function maskSecret(secret) {
  if (!secret || secret.length < 8) return "***";
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
}
function debugLog(message, data = null, verbose = false) {
  if (!verbose) return;
  console.log(chalk11.dim(`[DEBUG] ${message}`));
  if (data) {
    if (typeof data === "object") {
      console.log(chalk11.dim(JSON.stringify(data, null, 2)));
    } else {
      console.log(chalk11.dim(String(data)));
    }
  }
}
function debugError(error, verbose = false) {
  if (!verbose) return;
  console.error(chalk11.red.dim(`[DEBUG ERROR] ${error.message}`));
  if (error.stack) {
    console.error(chalk11.red.dim(error.stack));
  }
  if (error.code) {
    console.error(chalk11.red.dim(`[DEBUG ERROR CODE] ${error.code}`));
  }
  if (error.details) {
    console.error(chalk11.red.dim(`[DEBUG ERROR DETAILS] ${error.details}`));
  }
  if (error.hint) {
    console.error(chalk11.red.dim(`[DEBUG ERROR HINT] ${error.hint}`));
  }
}
var init_debug = __esm({
  "src/utils/debug.js"() {
  }
});

// src/utils/supabase.js
var supabase_exports = {};
__export(supabase_exports, {
  addSchemaToPostgrestConfig: () => addSchemaToPostgrestConfig,
  applySchemaViaPg: () => applySchemaViaPg,
  assignUserToTenant: () => assignUserToTenant,
  callRpcViaHttp: () => callRpcViaHttp,
  copyDefaultTheme: () => copyDefaultTheme,
  createSupabaseProject: () => createSupabaseProject,
  createTenant: () => createTenant,
  ensureTenantSchemaViaRpc: () => ensureTenantSchemaViaRpc,
  fetchAnonKeyFromSupabase: () => fetchAnonKeyFromSupabase,
  fetchDbPasswordFromVault: () => fetchDbPasswordFromVault,
  fetchServiceRoleKeyFromSupabase: () => fetchServiceRoleKeyFromSupabase,
  fetchServiceRoleKeyFromVault: () => fetchServiceRoleKeyFromVault,
  getPostgrestConfig: () => getPostgrestConfig,
  getSecretsViaDirectSql: () => getSecretsViaDirectSql,
  isSchemaManagementAvailable: () => isSchemaManagementAvailable,
  listSupabaseProjects: () => listSupabaseProjects,
  updatePostgrestConfig: () => updatePostgrestConfig
});
async function getSecretsViaDirectSql(supabaseUrl, serviceRoleKey, secretName = null, verbose = false) {
  debugLog("Direkter SQL-Fallback: Rufe Vault-Funktion direkt \xFCber SQL auf", { secretName }, verbose);
  try {
    if (secretName) {
      const url = `${supabaseUrl}/rest/v1/rpc/read_secret`;
      debugLog(`HTTP Request URL: ${url}`, null, verbose);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({ secret_name: secretName })
      });
      if (!response.ok) {
        const errorText = await response.text();
        debugLog(`HTTP Response Error: ${response.status} - ${errorText}`, null, verbose);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.text();
      debugLog(`HTTP Response Data: ${data.substring(0, 100)}`, null, verbose);
      return { data, error: null };
    } else {
      const url = `${supabaseUrl}/rest/v1/rpc/get_all_secrets_for_env`;
      debugLog(`HTTP Request URL: ${url}`, null, verbose);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({})
      });
      if (!response.ok) {
        const errorText = await response.text();
        debugLog(`HTTP Response Error: ${response.status} - ${errorText}`, null, verbose);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      debugLog(`HTTP Response Data`, typeof data === "object" ? Object.keys(data) : data, verbose);
      return { data, error: null };
    }
  } catch (error) {
    debugError(error, verbose);
    throw error;
  }
}
async function callRpcViaHttp(supabaseUrl, serviceRoleKey, functionName, params = {}, verbose = false, schema = null) {
  debugLog(`HTTP-Fallback: Rufe ${functionName} \xFCber PostgREST auf`, { url: supabaseUrl, function: functionName, schema }, verbose);
  try {
    const url = `${supabaseUrl}/rest/v1/rpc/${functionName}`;
    debugLog(`HTTP Request URL: ${url}`, null, verbose);
    const headers = {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Prefer": "return=representation"
    };
    if (schema) {
      headers["Content-Profile"] = schema;
    }
    debugLog(`HTTP Request Headers`, {
      "Content-Type": headers["Content-Type"],
      "apikey": maskSecret(serviceRoleKey),
      "Authorization": `Bearer ${maskSecret(serviceRoleKey)}`,
      "Prefer": headers["Prefer"]
    }, verbose);
    debugLog(`HTTP Request Body`, params, verbose);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(params)
    });
    debugLog(`HTTP Response Status: ${response.status} ${response.statusText}`, null, verbose);
    if (!response.ok) {
      const errorText = await response.text();
      debugLog(`HTTP Response Error Body`, errorText, verbose);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    debugLog(`HTTP Response Data`, typeof data === "object" ? Object.keys(data) : data, verbose);
    return { data, error: null };
  } catch (error) {
    debugError(error, verbose);
    throw error;
  }
}
async function listSupabaseProjects(debugFn) {
  try {
    let output;
    try {
      output = execSync("supabase projects list", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
        shell: true
      });
    } catch (execError) {
      if (execError.stdout) {
        output = execError.stdout.toString("utf-8");
      } else if (execError.stderr) {
        output = execError.stderr.toString("utf-8");
      } else {
        if (debugFn) {
          debugFn(`execSync Error: ${execError.message}`);
        }
        throw execError;
      }
    }
    const normalizedOutput = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalizedOutput.split("\n");
    const projects = [];
    let headerFound = false;
    let inTable = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.includes("LINKED") && trimmed.includes("ORG ID")) {
        headerFound = true;
        continue;
      }
      if (headerFound && (trimmed.includes("\u2500") || trimmed.includes("\u253C")) && trimmed.length > 50) {
        inTable = true;
        continue;
      }
      if ((inTable || headerFound) && (trimmed.includes("\u2502") || trimmed.includes("|")) && !trimmed.includes("LINKED")) {
        const parts = trimmed.split(/[│|]/).map((p) => p.trim());
        if (parts.length >= 4) {
          const referenceId = parts[2] || "";
          const name = parts[3] || "";
          if (referenceId && referenceId.length > 0 && !referenceId.includes("zedhieyjlfhygsfxzbze")) {
            projects.push({
              id: referenceId,
              project_ref: referenceId,
              name,
              org_id: parts[1] || "",
              region: parts[4] || ""
            });
          }
        }
      }
    }
    return projects;
  } catch (error) {
    if (debugFn) {
      debugFn(`Fehler beim Abrufen der Projekte: ${error.message}`);
    }
    return [];
  }
}
async function fetchAnonKeyFromSupabase(projectRef, debugFn) {
  try {
    let output;
    try {
      output = execSync(
        `supabase projects api-keys --project-ref ${projectRef} --output json`,
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          shell: true
        }
      );
    } catch (execError) {
      if (execError.stdout) {
        output = execError.stdout.toString("utf-8");
      } else if (execError.stderr) {
        output = execError.stderr.toString("utf-8");
      } else {
        if (debugFn) {
          debugFn(`\u26A0\uFE0F  CLI-Fehler: ${execError.message}`);
        }
        return null;
      }
    }
    const trimmedOutput = output.trim();
    if (!trimmedOutput || trimmedOutput.length === 0) {
      return null;
    }
    let keys;
    try {
      keys = JSON.parse(trimmedOutput);
    } catch (parseError) {
      const lines = trimmedOutput.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes("anon") || trimmed.includes("public")) {
          const parts = trimmed.split(/[│|]/).map((p) => p.trim());
          if (parts.length >= 2) {
            const keyName = parts[0].toLowerCase();
            const keyValue = parts[1];
            if ((keyName.includes("anon") || keyName.includes("public")) && keyValue && keyValue.length > 20) {
              return keyValue;
            }
          }
        }
      }
      return null;
    }
    if (Array.isArray(keys)) {
      let anonKey = keys.find((k) => {
        const name = (k.name || "").toLowerCase();
        const id = (k.id || "").toLowerCase();
        return name === "anon" || id === "anon";
      });
      if (!anonKey) {
        anonKey = keys.find((k) => {
          const type = (k.type || "").toLowerCase();
          return type === "publishable";
        });
      }
      if (anonKey && anonKey.api_key) {
        return anonKey.api_key;
      }
    } else if (keys.anon_key || keys.anon || keys.public || keys.api_key) {
      return keys.anon_key || keys.anon || keys.public || keys.api_key;
    }
    return null;
  } catch (error) {
    if (debugFn) {
      debugFn(`\u26A0\uFE0F  Fehler beim Abrufen des Anon Keys: ${error.message}`);
    }
    return null;
  }
}
async function fetchServiceRoleKeyFromSupabase(projectRef, debugFn) {
  try {
    let output;
    try {
      output = execSync(
        `supabase projects api-keys --project-ref ${projectRef}`,
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          shell: true
        }
      );
    } catch (execError) {
      if (execError.stdout) {
        output = execError.stdout.toString("utf-8");
      } else if (execError.stderr) {
        output = execError.stderr.toString("utf-8");
      } else {
        return null;
      }
    }
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, "").replace(/\u001b\[\d+m/g, "");
    const lines = cleanOutput.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes("service_role")) {
        const parts = trimmed.split(/[│|]/).map((p) => p.trim());
        if (parts.length >= 2) {
          const keyName = parts[0].toLowerCase();
          const keyValue = parts[1].replace(/\x1b\[[0-9;]*m/g, "").trim();
          if (keyName.includes("service_role") && keyValue && keyValue.length > 20) {
            return keyValue;
          }
        }
      }
    }
    return null;
  } catch (error) {
    if (debugFn) {
      debugFn(`\u274C Fehler beim Abrufen von Service Role Key: ${error.message}`);
    }
    return null;
  }
}
async function fetchServiceRoleKeyFromVault(infraDbUrl, tempServiceRoleKey, debugFn) {
  if (!tempServiceRoleKey) {
    if (debugFn) {
      debugFn("\u26A0\uFE0F  Kein tempor\xE4rer Service Role Key f\xFCr Vault-Zugriff vorhanden");
    }
    return null;
  }
  try {
    if (debugFn) {
      debugFn(`\u{1F50D} Versuche SERVICE_ROLE_KEY aus Vault zu holen...`);
    }
    const { callRpcViaHttp: callRpcViaHttp2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const result = await callRpcViaHttp2(
      infraDbUrl,
      tempServiceRoleKey,
      "read_secret",
      { secret_name: "SERVICE_ROLE_KEY" },
      false
      // verbose
    );
    if (result.error) {
      if (debugFn) {
        debugFn(`\u26A0\uFE0F  Vault-Zugriff fehlgeschlagen: ${result.error.message}`);
      }
      return null;
    }
    if (result.data && typeof result.data === "string" && result.data.length > 20) {
      if (debugFn) {
        debugFn(`\u2705 SERVICE_ROLE_KEY aus Vault geholt`);
      }
      return result.data;
    }
    return null;
  } catch (error) {
    if (debugFn) {
      debugFn(`\u26A0\uFE0F  Fehler beim Abrufen aus Vault: ${error.message}`);
    }
    return null;
  }
}
async function fetchDbPasswordFromVault(infraDbUrl, tempServiceRoleKey, debugFn) {
  if (!tempServiceRoleKey) {
    if (debugFn) {
      debugFn("\u26A0\uFE0F  Kein tempor\xE4rer Service Role Key f\xFCr Vault-Zugriff vorhanden");
    }
    return null;
  }
  try {
    if (debugFn) {
      debugFn(`\u{1F50D} Versuche SUPABASE_DB_PASSWORD aus Vault zu holen...`);
    }
    const { callRpcViaHttp: callRpcViaHttp2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const result = await callRpcViaHttp2(
      infraDbUrl,
      tempServiceRoleKey,
      "read_secret",
      { secret_name: "SUPABASE_DB_PASSWORD" },
      false
      // verbose
    );
    if (result.error) {
      if (debugFn) {
        debugFn(`\u26A0\uFE0F  Vault-Zugriff fehlgeschlagen: ${result.error.message}`);
      }
      return null;
    }
    if (result.data && typeof result.data === "string" && result.data.length > 0) {
      if (debugFn) {
        debugFn(`\u2705 SUPABASE_DB_PASSWORD aus Vault geholt`);
      }
      return result.data;
    }
    return null;
  } catch (error) {
    if (debugFn) {
      debugFn(`\u26A0\uFE0F  Fehler beim Abrufen aus Vault: ${error.message}`);
    }
    return null;
  }
}
async function applySchemaViaPg(projectRef, schemaName, dbPassword, verbose = false) {
  const endpoints = [
    // Session Pooler - funktioniert besser auf Windows (IPv4)
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
    // Direkter Zugang (IPv6 auf manchen Systemen)
    `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`
  ];
  let lastError = null;
  for (const connectionString of endpoints) {
    const host = connectionString.includes("pooler") ? "Pooler" : "Direct";
    debugLog(`Versuche PostgreSQL-Verbindung via ${host}...`, null, verbose);
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      debugLog(`PostgreSQL-Verbindung erfolgreich (${host})`, null, verbose);
      await applySchemaSetup(client, schemaName, verbose);
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      debugLog(`${host}-Verbindung fehlgeschlagen: ${error.message}`, null, verbose);
      try {
        await client.end();
      } catch (e) {
      }
    }
  }
  throw lastError || new Error("Alle PostgreSQL-Verbindungsversuche fehlgeschlagen");
}
async function applySchemaSetup(client, schemaName, verbose = false) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  debugLog(`Schema "${schemaName}" erstellt`, null, verbose);
  await client.query(`GRANT USAGE ON SCHEMA "${schemaName}" TO authenticated, anon`);
  await client.query(`GRANT ALL ON ALL TABLES IN SCHEMA "${schemaName}" TO authenticated`);
  await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA "${schemaName}" TO anon`);
  debugLog(`Grants f\xFCr Schema "${schemaName}" gesetzt`, null, verbose);
  await client.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" 
      GRANT ALL ON TABLES TO authenticated
  `);
  await client.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" 
      GRANT SELECT ON TABLES TO anon
  `);
  debugLog(`Default privileges f\xFCr Schema "${schemaName}" gesetzt`, null, verbose);
  const currentConfig = await client.query(`
    SELECT setting FROM pg_settings WHERE name = 'pgrst.db_schemas'
  `);
  let currentSchemas = "public, infra, storage, graphql_public, realtime";
  if (currentConfig.rows.length > 0 && currentConfig.rows[0].setting) {
    currentSchemas = currentConfig.rows[0].setting;
  }
  if (!currentSchemas.includes(schemaName)) {
    const newSchemas = currentSchemas + ", " + schemaName;
    await client.query(`
      ALTER ROLE authenticator 
        SET pgrst.db_schemas = '${newSchemas}'
    `);
    debugLog(`PostgREST konfiguriert: pgrst.db_schemas = '${newSchemas}'`, null, verbose);
  } else {
    debugLog(`Schema "${schemaName}" bereits in PostgREST konfiguriert`, null, verbose);
  }
  try {
    await client.query(`NOTIFY pgrst, 'reload config'`);
    debugLog(`PostgREST Reload-Benachrichtigung gesendet`, null, verbose);
  } catch (notifyError) {
    debugLog(`PostgREST Reload nicht m\xF6glich (ignoriert)`, null, verbose);
  }
}
async function createSupabaseProject(projectName, organizationId, dbPassword, region = "eu-central-1") {
  try {
    const output = execSync(
      `supabase projects create "${projectName}" --org-id ${organizationId} --db-password "${dbPassword}" --region ${region} --output json`,
      {
        encoding: "utf-8",
        stdio: "pipe"
      }
    );
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Fehler beim Erstellen des Supabase-Projekts: ${error.message}`);
  }
}
async function ensureTenantSchemaViaRpc(supabaseUrl, serviceRoleKey, schemaName, verbose = false) {
  debugLog(`Richte Schema "${schemaName}" via RPC ein...`, { url: supabaseUrl }, verbose);
  try {
    const url = `${supabaseUrl}/rest/v1/rpc/ensure_tenant_schema`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Prefer": "return=representation",
        "Content-Profile": "infra"
        // Funktion liegt im infra-Schema
      },
      body: JSON.stringify({ p_schema_name: schemaName })
    });
    if (!response.ok) {
      const errorText = await response.text();
      debugLog(`RPC Fehler: ${response.status}`, errorText, verbose);
      if (response.status === 404 || errorText.includes("function") || errorText.includes("does not exist")) {
        return {
          success: false,
          error: "RPC-Funktion nicht gefunden. Bitte erst infra.ensure_tenant_schema() in der INFRA-DB installieren.",
          needsSetup: true
        };
      }
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }
    const result = await response.json();
    debugLog(`RPC Ergebnis:`, result, verbose);
    if (result.success) {
      return {
        success: true,
        message: result.message,
        schemasExposed: result.schemas_exposed
      };
    } else {
      return {
        success: false,
        error: result.error || "Unbekannter Fehler"
      };
    }
  } catch (error) {
    debugError(error, verbose);
    return {
      success: false,
      error: error.message
    };
  }
}
async function isSchemaManagementAvailable(supabaseUrl, serviceRoleKey) {
  try {
    const url = `${supabaseUrl}/rest/v1/rpc/ensure_tenant_schema`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Profile": "infra"
        // Funktion liegt im infra-Schema
      },
      body: JSON.stringify({ p_schema_name: "123invalid" })
    });
    if (response.ok) {
      const result = await response.json();
      return true;
    }
    if (response.status === 404) {
      return false;
    }
    const errorText = await response.text();
    if (errorText.includes("does not exist") || errorText.includes("function")) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}
async function getPostgrestConfig(projectRef, pat, verbose = false) {
  debugLog(`Management API: Hole PostgREST-Config f\xFCr ${projectRef}`, null, verbose);
  try {
    const url = `https://api.supabase.com/v1/projects/${projectRef}/postgrest`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${pat}`,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      debugLog(`Management API Error: ${response.status} - ${errorText}`, null, verbose);
      return { db_schema: "", error: `HTTP ${response.status}: ${errorText}` };
    }
    const config = await response.json();
    debugLog(`Aktuelle db_schema: ${config.db_schema}`, null, verbose);
    return {
      db_schema: config.db_schema || "public",
      error: null
    };
  } catch (error) {
    debugLog(`Management API Exception: ${error.message}`, null, verbose);
    return { db_schema: "", error: error.message };
  }
}
async function updatePostgrestConfig(projectRef, pat, dbSchema, verbose = false) {
  debugLog(`Management API: Update db_schema auf "${dbSchema}"`, null, verbose);
  try {
    const url = `https://api.supabase.com/v1/projects/${projectRef}/postgrest`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${pat}`,
        "Content-Type": "application/json"
      },
      // API erwartet db_schema als String, nicht Array
      body: JSON.stringify({ db_schema: dbSchema })
    });
    if (!response.ok) {
      const errorText = await response.text();
      debugLog(`Management API PATCH Error: ${response.status} - ${errorText}`, null, verbose);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
    debugLog(`PostgREST-Config erfolgreich aktualisiert`, null, verbose);
    return { success: true, error: null };
  } catch (error) {
    debugLog(`Management API Exception: ${error.message}`, null, verbose);
    return { success: false, error: error.message };
  }
}
async function addSchemaToPostgrestConfig(projectRef, pat, schemaName, verbose = false) {
  debugLog(`Management API: F\xFCge Schema "${schemaName}" hinzu`, null, verbose);
  const { db_schema, error: getError } = await getPostgrestConfig(projectRef, pat, verbose);
  if (getError) {
    return { success: false, schemas: [], error: getError };
  }
  const currentSchemas = db_schema.split(",").map((s) => s.trim()).filter(Boolean);
  if (currentSchemas.includes(schemaName)) {
    debugLog(`Schema "${schemaName}" bereits in db_schema`, null, verbose);
    return { success: true, schemas: currentSchemas, error: null };
  }
  const newSchemas = [...currentSchemas, schemaName];
  const newDbSchema = newSchemas.join(",");
  const { success, error: updateError } = await updatePostgrestConfig(projectRef, pat, newDbSchema, verbose);
  if (!success) {
    return { success: false, schemas: currentSchemas, error: updateError };
  }
  return { success: true, schemas: newSchemas, error: null };
}
async function createTenant(supabaseUrl, serviceRoleKey, slug, name, verbose = false) {
  debugLog(`Erstelle Tenant: ${slug} (${name})`, null, verbose);
  try {
    const checkUrl = `${supabaseUrl}/rest/v1/rpc/get_tenant_by_slug`;
    const checkResponse = await fetch(checkUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Profile": "infra"
      },
      body: JSON.stringify({ p_slug: slug })
    });
    if (checkResponse.ok) {
      const existing = await checkResponse.json();
      if (existing && existing.length > 0) {
        debugLog(`Tenant "${slug}" existiert bereits: ${existing[0].id}`, null, verbose);
        return {
          success: true,
          tenantId: existing[0].id,
          error: null
        };
      }
    }
    const url = `${supabaseUrl}/rest/v1/rpc/create_tenant`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Profile": "infra"
      },
      body: JSON.stringify({
        p_slug: slug,
        p_name: name
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      debugLog(`Tenant-Erstellung fehlgeschlagen: ${response.status}`, errorText, verbose);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }
    const tenantId = await response.json();
    debugLog(`Tenant erstellt: ${tenantId}`, null, verbose);
    return {
      success: true,
      tenantId,
      error: null
    };
  } catch (error) {
    debugError(error, verbose);
    return {
      success: false,
      error: error.message
    };
  }
}
async function assignUserToTenant(supabaseUrl, serviceRoleKey, userId, tenantId, role = "owner", verbose = false) {
  debugLog(`Ordne User ${userId} Tenant ${tenantId} zu (Rolle: ${role})`, null, verbose);
  try {
    const url = `${supabaseUrl}/rest/v1/rpc/assign_user_to_tenant`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Profile": "infra"
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_tenant_id: tenantId,
        p_role: role
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      debugLog(`User-Tenant-Zuordnung fehlgeschlagen: ${response.status}`, errorText, verbose);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }
    debugLog(`User-Tenant-Zuordnung erfolgreich`, null, verbose);
    return { success: true, error: null };
  } catch (error) {
    debugError(error, verbose);
    return {
      success: false,
      error: error.message
    };
  }
}
async function copyDefaultTheme(supabaseUrl, serviceRoleKey, tenantSlug, verbose = false) {
  debugLog(`Kopiere Themes f\xFCr Tenant: ${tenantSlug}`, null, verbose);
  const copied = [];
  const skipped = [];
  try {
    const listUrl = `${supabaseUrl}/storage/v1/object/list/themes`;
    const rootResponse = await fetch(listUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ prefix: "", limit: 100 })
    });
    if (!rootResponse.ok) {
      return { success: false, copied: [], skipped: [], error: "Kann Theme-Liste nicht laden" };
    }
    const rootFiles = await rootResponse.json();
    const rootThemes = rootFiles.filter((f) => f.name.endsWith(".css"));
    if (rootThemes.length === 0) {
      debugLog(`Keine Themes im Root gefunden`, null, verbose);
      return { success: false, copied: [], skipped: [], error: "Keine Themes im Root vorhanden" };
    }
    debugLog(`${rootThemes.length} Themes im Root gefunden`, rootThemes.map((t) => t.name), verbose);
    const tenantResponse = await fetch(listUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ prefix: tenantSlug + "/", limit: 100 })
    });
    const existingThemes = tenantResponse.ok ? (await tenantResponse.json()).map((f) => f.name) : [];
    for (const theme of rootThemes) {
      const themeName = theme.name;
      if (existingThemes.includes(themeName)) {
        debugLog(`Theme existiert bereits: ${tenantSlug}/${themeName}`, null, verbose);
        skipped.push(themeName);
        continue;
      }
      const downloadUrl = `${supabaseUrl}/storage/v1/object/public/themes/${themeName}`;
      const downloadResponse = await fetch(downloadUrl);
      if (!downloadResponse.ok) {
        debugLog(`Theme nicht ladbar: ${themeName}`, null, verbose);
        skipped.push(themeName);
        continue;
      }
      const themeContent = await downloadResponse.text();
      const uploadUrl = `${supabaseUrl}/storage/v1/object/themes/${tenantSlug}/${themeName}`;
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/css",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "x-upsert": "true"
        },
        body: themeContent
      });
      if (uploadResponse.ok) {
        debugLog(`Theme kopiert: ${tenantSlug}/${themeName}`, null, verbose);
        copied.push(themeName);
      } else {
        debugLog(`Theme-Upload fehlgeschlagen: ${themeName}`, null, verbose);
        skipped.push(themeName);
      }
    }
    if (!existingThemes.includes("default.css") && !copied.includes("default.css")) {
      const fallbackTheme = copied[0] || rootThemes[0]?.name;
      if (fallbackTheme && fallbackTheme !== "default.css") {
        const downloadUrl = `${supabaseUrl}/storage/v1/object/public/themes/${tenantSlug}/${fallbackTheme}`;
        const downloadResponse = await fetch(downloadUrl);
        if (downloadResponse.ok) {
          const themeContent = await downloadResponse.text();
          const uploadUrl = `${supabaseUrl}/storage/v1/object/themes/${tenantSlug}/default.css`;
          await fetch(uploadUrl, {
            method: "POST",
            headers: {
              "Content-Type": "text/css",
              "apikey": serviceRoleKey,
              "Authorization": `Bearer ${serviceRoleKey}`,
              "x-upsert": "true"
            },
            body: themeContent
          });
          debugLog(`Default-Theme erstellt aus: ${fallbackTheme}`, null, verbose);
          copied.push("default.css");
        }
      }
    }
    debugLog(`Themes kopiert: ${copied.length}, \xFCbersprungen: ${skipped.length}`, null, verbose);
    return { success: true, copied, skipped };
  } catch (error) {
    debugError(error, verbose);
    return { success: false, copied, skipped, error: error.message };
  }
}
var Client;
var init_supabase = __esm({
  "src/utils/supabase.js"() {
    init_debug();
    ({ Client } = pg);
  }
});

// src/wizard/initWizard.js
var initWizard_exports = {};
__export(initWizard_exports, {
  loadExistingProfile: () => loadExistingProfile,
  runInitWizard: () => runInitWizard
});
async function loadExistingProfile(projectRoot) {
  if (projectRoot) {
    try {
      const localProfileFiles = fs6.readdirSync(projectRoot).filter((f) => f.endsWith(".kesselprofile"));
      if (localProfileFiles.length > 0) {
        const localProfilesWithStats = localProfileFiles.map((file) => {
          const filePath = path6.join(projectRoot, file);
          try {
            const stats = fs6.statSync(filePath);
            return { file, path: filePath, mtime: stats.mtime };
          } catch {
            return null;
          }
        }).filter(Boolean);
        if (localProfilesWithStats.length > 0) {
          localProfilesWithStats.sort((a, b) => b.mtime - a.mtime);
          const newest = localProfilesWithStats[0];
          const usernameFromFile = newest.file.replace(".kesselprofile", "");
          try {
            const content = fs6.readFileSync(newest.path, "utf-8");
            const profile = {};
            const lines = content.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#")) continue;
              const match = trimmed.match(/^([^=]+)=(.*)$/);
              if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, "");
                profile[key] = value;
              }
            }
            const profileUsername = profile.USERNAME || usernameFromFile;
            const hasInfraUrl = profile.SUPABASE_INFRA_URL || profile.SUPABASE_BACKEND_URL;
            if (profileUsername && hasInfraUrl) {
              profile.USERNAME = profileUsername;
              return { profile, source: "local", username: profileUsername };
            }
          } catch (error) {
          }
        }
      }
    } catch (error) {
    }
  }
  try {
    const profileDir = getProfileDir();
    if (fs6.existsSync(profileDir)) {
      const files = fs6.readdirSync(profileDir);
      const profileFiles = files.filter((f) => f.endsWith(".kesselprofile"));
      if (profileFiles.length > 0) {
        const profilesWithStats = profileFiles.map((file) => {
          const filePath = path6.join(profileDir, file);
          try {
            const stats = fs6.statSync(filePath);
            return { file, path: filePath, mtime: stats.mtime };
          } catch {
            return null;
          }
        }).filter(Boolean);
        if (profilesWithStats.length > 0) {
          profilesWithStats.sort((a, b) => b.mtime - a.mtime);
          const newest = profilesWithStats[0];
          const usernameFromFile = newest.file.replace(".kesselprofile", "");
          const profile = loadProfile(usernameFromFile);
          if (profile && profile.USERNAME) {
            return { profile, source: "system", username: usernameFromFile };
          }
        }
      }
    }
  } catch (error) {
  }
  return null;
}
function migrateProfile(profile) {
  const migrated = { ...profile };
  if (profile.SUPABASE_BACKEND_URL && !profile.SUPABASE_INFRA_URL) {
    const backendUrl = profile.SUPABASE_BACKEND_URL;
    if (backendUrl.includes("ufqlocxqizmiaozkashi")) {
      migrated.SUPABASE_INFRA_URL = backendUrl;
    }
  }
  if (profile.SUPABASE_VAULT_SERVICE_ROLE_KEY && !profile.SUPABASE_SERVICE_ROLE_KEY) {
    migrated.SUPABASE_SERVICE_ROLE_KEY = profile.SUPABASE_VAULT_SERVICE_ROLE_KEY;
  }
  return migrated;
}
async function runInitWizard(projectNameArg = null, projectRoot = null) {
  const existing = await loadExistingProfile(projectRoot);
  let profile = existing?.profile || null;
  if (profile) {
    profile = migrateProfile(profile);
  }
  const { username } = await enquirer.prompt({
    type: "input",
    name: "username",
    message: "Dein Username:",
    initial: profile?.USERNAME || existing?.username || "",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Username ist erforderlich";
      }
      return true;
    }
  });
  const normalizedUsername = normalizeUsername(username);
  if (!profile) {
    profile = loadProfile(normalizedUsername);
    if (profile) {
      profile = migrateProfile(profile);
    }
  }
  const backendUrlFromProfile = profile?.SUPABASE_BACKEND_URL;
  const isValidInfraDb = backendUrlFromProfile?.includes("ufqlocxqizmiaozkashi");
  const infraUrlDefault = profile?.SUPABASE_INFRA_URL || (isValidInfraDb ? backendUrlFromProfile : null) || DEFAULTS.infraDb.url;
  const { infraUrl } = await enquirer.prompt({
    type: "input",
    name: "infraUrl",
    message: "INFRA-DB URL (Kessel - Auth, Vault, Multi-Tenant):",
    initial: infraUrlDefault,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "INFRA-DB URL ist erforderlich";
      }
      try {
        new URL(value);
        return true;
      } catch {
        return "Bitte eine g\xFCltige URL eingeben";
      }
    }
  });
  const { devUrl } = await enquirer.prompt({
    type: "input",
    name: "devUrl",
    message: "DEV-DB URL (App-Daten, Entwicklung):",
    initial: profile?.SUPABASE_DEV_URL || DEFAULTS.devDb.url,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "DEV-DB URL ist erforderlich";
      }
      try {
        new URL(value);
        return true;
      } catch {
        return "Bitte eine g\xFCltige URL eingeben";
      }
    }
  });
  const infraProjectRef = infraUrl ? new URL(infraUrl).hostname.split(".")[0] : null;
  let serviceRoleKey = null;
  const tempServiceRoleKey = profile?.SUPABASE_SERVICE_ROLE_KEY || profile?.SUPABASE_VAULT_SERVICE_ROLE_KEY;
  if (tempServiceRoleKey && infraUrl) {
    console.log(chalk11.blue("\u{1F50D} Versuche SERVICE_ROLE_KEY aus Vault zu holen..."));
    serviceRoleKey = await fetchServiceRoleKeyFromVault(infraUrl, tempServiceRoleKey, (msg) => {
    });
    if (serviceRoleKey) {
      console.log(chalk11.green("\u2713 SERVICE_ROLE_KEY aus Vault geholt"));
    } else {
      console.log(chalk11.yellow("\u26A0\uFE0F  Vault-Zugriff fehlgeschlagen, versuche Management API..."));
    }
  }
  if (!serviceRoleKey && infraProjectRef) {
    serviceRoleKey = await fetchServiceRoleKeyFromSupabase(infraProjectRef, (msg) => {
    });
    if (serviceRoleKey) {
      console.log(chalk11.green("\u2713 SERVICE_ROLE_KEY \xFCber Management API geholt"));
    }
  }
  if (!serviceRoleKey) {
    serviceRoleKey = tempServiceRoleKey;
    if (serviceRoleKey) {
      console.log(chalk11.dim("\u2139\uFE0F  Verwende SERVICE_ROLE_KEY aus Profil"));
    }
  }
  if (!serviceRoleKey) {
    const prompt = await enquirer.prompt({
      type: "password",
      name: "serviceRoleKey",
      message: "SERVICE_ROLE_KEY (f\xFCr INFRA-DB/Vault-Zugriff):",
      initial: "",
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Service Role Key ist erforderlich";
        }
        return true;
      }
    });
    serviceRoleKey = prompt.serviceRoleKey;
  }
  const currentDirName = projectRoot ? path6.basename(projectRoot) : "mein-projekt";
  const normalizedDirName = currentDirName.replace(/_/g, "-").toLowerCase();
  const defaultProjectName = projectNameArg || normalizedDirName;
  const { projectName } = await enquirer.prompt({
    type: "input",
    name: "projectName",
    message: "Projektname:",
    initial: defaultProjectName,
    validate: (value) => {
      if (!/^[a-z0-9-]+$/.test(value)) {
        return "Projektname darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten";
      }
      return true;
    }
  });
  const { createGithub } = await enquirer.prompt({
    type: "select",
    name: "createGithub",
    message: "GitHub Repository erstellen?",
    choices: [
      { name: "private", message: "Ja, privat" },
      { name: "public", message: "Ja, \xF6ffentlich" },
      { name: "none", message: "Nein, nur lokal" }
    ],
    initial: 0
  });
  const { autoInstallDeps } = await enquirer.prompt({
    type: "confirm",
    name: "autoInstallDeps",
    message: "Dependencies automatisch installieren?",
    initial: true
  });
  const { linkVercel } = await enquirer.prompt({
    type: "confirm",
    name: "linkVercel",
    message: "Mit Vercel verkn\xFCpfen?",
    initial: false
  });
  const { doInitialCommit } = await enquirer.prompt({
    type: "confirm",
    name: "doInitialCommit",
    message: "Initial Commit erstellen?",
    initial: true
  });
  const { doPush } = await enquirer.prompt({
    type: "confirm",
    name: "doPush",
    message: "\xC4nderungen zu GitHub pushen?",
    initial: createGithub !== "none" && doInitialCommit
  });
  const devProjectRef = devUrl ? new URL(devUrl).hostname.split(".")[0] : null;
  const schemaName = projectName.replace(/-/g, "_").toLowerCase();
  return {
    username: normalizedUsername,
    projectName,
    schemaName,
    infraDb: {
      url: infraUrl.trim(),
      projectRef: infraProjectRef
    },
    devDb: {
      url: devUrl.trim(),
      projectRef: devProjectRef
    },
    serviceRoleKey: serviceRoleKey.trim(),
    createGithub,
    autoInstallDeps,
    linkVercel,
    doInitialCommit,
    doPush,
    profile
    // Gespeichertes Profil für später
  };
}
var init_initWizard = __esm({
  "src/wizard/initWizard.js"() {
    init_profile();
    init_config();
    init_supabase();
  }
});
function cleanUrl(url) {
  if (!url) return "";
  return url.replace(/[\r\n#]+/g, "").trim();
}
function extractProjectRefFromJwt(jwt) {
  if (!jwt || typeof jwt !== "string") return null;
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    return payload.ref || null;
  } catch {
    return null;
  }
}
function isKeyForProject(serviceRoleKey, expectedProjectRef) {
  if (!serviceRoleKey || !expectedProjectRef) return false;
  const keyProjectRef = extractProjectRefFromJwt(serviceRoleKey);
  return keyProjectRef === expectedProjectRef;
}
function Wizard({ projectNameArg, onComplete, onError }) {
  const { isRawModeSupported } = useStdin();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [username, setUsername] = useState("");
  const [usernameSubmitted, setUsernameSubmitted] = useState(false);
  const [infraUrl, setInfraUrl] = useState("");
  const [infraUrlSubmitted, setInfraUrlSubmitted] = useState(false);
  const [devUrl, setDevUrl] = useState("");
  const [devUrlSubmitted, setDevUrlSubmitted] = useState(false);
  const [serviceRoleKey, setServiceRoleKey] = useState("");
  const [serviceRoleKeySubmitted, setServiceRoleKeySubmitted] = useState(false);
  const [fetchingServiceRoleKey, setFetchingServiceRoleKey] = useState(false);
  const [serviceRoleKeyStatus, setServiceRoleKeyStatus] = useState("");
  const [projectName, setProjectName] = useState(projectNameArg || "");
  const [projectNameSubmitted, setProjectNameSubmitted] = useState(false);
  const [installPath, setInstallPath] = useState("");
  const [installPathSubmitted, setInstallPathSubmitted] = useState(false);
  const [createGithub, setCreateGithub] = useState(null);
  const [autoInstallDeps, setAutoInstallDeps] = useState(null);
  const [linkVercel, setLinkVercel] = useState(null);
  const [doInitialCommit, setDoInitialCommit] = useState(null);
  const [doPush, setDoPush] = useState(null);
  const [dbPassword, setDbPassword] = useState("");
  const [dbPasswordSubmitted, setDbPasswordSubmitted] = useState(false);
  const [skipDbPassword, setSkipDbPassword] = useState(false);
  const [fetchingDbPassword, setFetchingDbPassword] = useState(false);
  const [dbPasswordFromVault, setDbPasswordFromVault] = useState(false);
  const [startDevServer, setStartDevServer] = useState(null);
  useEffect(() => {
    const loadProfile2 = async () => {
      try {
        const { loadExistingProfile: loadExistingProfile2 } = await Promise.resolve().then(() => (init_initWizard(), initWizard_exports));
        const { DEFAULTS: DEFAULTS2 } = await Promise.resolve().then(() => (init_config(), config_exports));
        const existing = await loadExistingProfile2(process.cwd());
        if (existing?.profile) {
          const profile = existing.profile;
          setUsername(profile.USERNAME || existing.username || "");
          const backendUrl = profile.SUPABASE_BACKEND_URL;
          const isValidInfraDb = backendUrl?.includes(DEFAULTS2.infraDb.projectRef);
          const infraUrlDefault = profile.SUPABASE_INFRA_URL || (isValidInfraDb ? backendUrl : null) || DEFAULTS2.infraDb.url;
          setInfraUrl(infraUrlDefault);
          setDevUrl(profile.SUPABASE_DEV_URL || DEFAULTS2.devDb.url);
        } else {
          const { DEFAULTS: DEFAULTS3 } = await Promise.resolve().then(() => (init_config(), config_exports));
          setInfraUrl(DEFAULTS3.infraDb.url);
          setDevUrl(DEFAULTS3.devDb.url);
        }
      } catch (error) {
        Promise.resolve().then(() => (init_config(), config_exports)).then(({ DEFAULTS: DEFAULTS2 }) => {
          setInfraUrl(DEFAULTS2.infraDb.url);
          setDevUrl(DEFAULTS2.devDb.url);
        });
      }
    };
    loadProfile2();
  }, []);
  useEffect(() => {
    if (step === 6 && !dbPasswordSubmitted && !fetchingDbPassword && infraUrl && serviceRoleKey) {
      const fetchFromVault = async () => {
        setFetchingDbPassword(true);
        try {
          const { fetchDbPasswordFromVault: fetchDbPasswordFromVault2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
          const cleanedInfraUrl = cleanUrl(infraUrl);
          const cleanedServiceRoleKey = serviceRoleKey.trim();
          const vaultPassword = await fetchDbPasswordFromVault2(
            cleanedInfraUrl,
            cleanedServiceRoleKey,
            null
            // debugFn
          );
          if (vaultPassword) {
            setDbPassword(vaultPassword);
            setDbPasswordFromVault(true);
          }
        } catch (error) {
        } finally {
          setFetchingDbPassword(false);
        }
      };
      fetchFromVault();
    }
  }, [step, dbPasswordSubmitted, fetchingDbPassword, infraUrl, serviceRoleKey]);
  const handleComplete = async (overrides = {}) => {
    setLoading(true);
    setLoadingMessage("Finalisiere Konfiguration...");
    try {
      const { DEFAULTS: DEFAULTS2 } = await Promise.resolve().then(() => (init_config(), config_exports));
      const cleanedInfraUrl = cleanUrl(infraUrl);
      const cleanedDevUrl = cleanUrl(devUrl);
      const cleanedServiceRoleKey = serviceRoleKey.trim();
      const infraProjectRef = cleanedInfraUrl ? new URL(cleanedInfraUrl).hostname.split(".")[0] : null;
      const devProjectRef = cleanedDevUrl ? new URL(cleanedDevUrl).hostname.split(".")[0] : null;
      const schemaName = projectName.replace(/-/g, "_").toLowerCase();
      let projectPath;
      if (installPath && installPath.trim()) {
        if (path6.isAbsolute(installPath.trim())) {
          projectPath = path6.resolve(installPath.trim(), projectName);
        } else {
          projectPath = path6.resolve(process.cwd(), installPath.trim(), projectName);
        }
      } else {
        projectPath = path6.resolve(process.cwd(), projectName);
      }
      if (infraProjectRef && cleanedServiceRoleKey) {
        if (!isKeyForProject(cleanedServiceRoleKey, infraProjectRef)) {
          const keyRef = extractProjectRefFromJwt(cleanedServiceRoleKey);
          throw new Error(
            `SERVICE_ROLE_KEY passt nicht zur INFRA-DB!
Key geh\xF6rt zu: ${keyRef}
INFRA-DB ist: ${infraProjectRef}

Bitte den korrekten SERVICE_ROLE_KEY f\xFCr "${infraProjectRef}" verwenden.`
          );
        }
      }
      const finalStartDevServer = overrides.startDevServer !== void 0 ? overrides.startDevServer : startDevServer;
      const finalConfig = {
        username: username.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        projectName,
        schemaName,
        projectPath,
        // Installationspfad hinzufügen
        infraDb: {
          url: cleanedInfraUrl,
          projectRef: infraProjectRef
        },
        devDb: {
          url: cleanedDevUrl,
          projectRef: devProjectRef
        },
        serviceRoleKey: cleanedServiceRoleKey,
        dbPassword: dbPassword || null,
        // Optional: für automatische Schema-Konfiguration
        createGithub: createGithub || "none",
        autoInstallDeps: autoInstallDeps !== false,
        linkVercel: linkVercel === true,
        doInitialCommit: doInitialCommit !== false,
        doPush: doPush === true,
        startDevServer: finalStartDevServer === true
      };
      if (onComplete) {
        onComplete(finalConfig);
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };
  if (!isRawModeSupported) {
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(Text, { color: "red", bold: true }, "\u274C Fehler: Raw mode wird nicht unterst\xFCtzt"), /* @__PURE__ */ React5.createElement(Text, { color: "yellow" }, "   Diese CLI ben\xF6tigt ein interaktives Terminal."), /* @__PURE__ */ React5.createElement(Text, { color: "yellow" }, "   Bitte f\xFChre die CLI in einem Terminal aus (nicht in einem Pipe oder Script)."));
  }
  if (loading) {
    return /* @__PURE__ */ React5.createElement(Box, null, /* @__PURE__ */ React5.createElement(Spinner2, { type: "dots" }), /* @__PURE__ */ React5.createElement(Text, null, " ", loadingMessage));
  }
  if (step === 0) {
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "Dein Username:"), /* @__PURE__ */ React5.createElement(
      TextInput,
      {
        value: username,
        onChange: setUsername,
        onSubmit: (value) => {
          if (value.trim()) {
            setUsernameSubmitted(true);
            setStep(1);
          }
        }
      }
    ));
  }
  if (step === 1) {
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "INFRA-DB URL (Kessel - Auth, Vault, Multi-Tenant):"), /* @__PURE__ */ React5.createElement(
      TextInput,
      {
        value: infraUrl,
        onChange: setInfraUrl,
        onSubmit: (value) => {
          if (value.trim()) {
            try {
              new URL(value);
              setInfraUrlSubmitted(true);
              setStep(2);
            } catch {
            }
          }
        }
      }
    ));
  }
  if (step === 2) {
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "DEV-DB URL (App-Daten, Entwicklung):"), /* @__PURE__ */ React5.createElement(
      TextInput,
      {
        value: devUrl,
        onChange: setDevUrl,
        onSubmit: async (value) => {
          if (value.trim()) {
            try {
              new URL(value);
              setDevUrlSubmitted(true);
              setFetchingServiceRoleKey(true);
              setServiceRoleKeyStatus("Versuche SERVICE_ROLE_KEY automatisch zu holen...");
              try {
                const { fetchServiceRoleKeyFromVault: fetchServiceRoleKeyFromVault2, fetchServiceRoleKeyFromSupabase: fetchServiceRoleKeyFromSupabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
                const { loadExistingProfile: loadExistingProfile2 } = await Promise.resolve().then(() => (init_initWizard(), initWizard_exports));
                const existing = await loadExistingProfile2(process.cwd());
                const profile = existing?.profile || {};
                const tempServiceRoleKey = profile.SUPABASE_SERVICE_ROLE_KEY || profile.SUPABASE_VAULT_SERVICE_ROLE_KEY;
                let fetchedKey = null;
                const cleanedInfraUrlForFetch = cleanUrl(infraUrl);
                const infraProjectRef = cleanedInfraUrlForFetch ? new URL(cleanedInfraUrlForFetch).hostname.split(".")[0] : null;
                if (tempServiceRoleKey && infraUrl) {
                  setServiceRoleKeyStatus("\u{1F50D} Versuche SERVICE_ROLE_KEY aus Vault zu holen...");
                  fetchedKey = await fetchServiceRoleKeyFromVault2(infraUrl, tempServiceRoleKey, () => {
                  });
                  if (fetchedKey) {
                    setServiceRoleKeyStatus("\u2713 SERVICE_ROLE_KEY aus Vault geholt");
                    setServiceRoleKey(fetchedKey);
                    setFetchingServiceRoleKey(false);
                    setServiceRoleKeySubmitted(true);
                    setStep(4);
                    return;
                  }
                }
                if (!fetchedKey && infraProjectRef) {
                  setServiceRoleKeyStatus("\u{1F50D} Versuche SERVICE_ROLE_KEY \xFCber Management API...");
                  fetchedKey = await fetchServiceRoleKeyFromSupabase2(infraProjectRef, () => {
                  });
                  if (fetchedKey) {
                    setServiceRoleKeyStatus("\u2713 SERVICE_ROLE_KEY \xFCber Management API geholt");
                    setServiceRoleKey(fetchedKey);
                    setFetchingServiceRoleKey(false);
                    setServiceRoleKeySubmitted(true);
                    setStep(4);
                    return;
                  }
                }
                if (!fetchedKey && tempServiceRoleKey && infraProjectRef) {
                  if (isKeyForProject(tempServiceRoleKey, infraProjectRef)) {
                    setServiceRoleKeyStatus("\u2139\uFE0F  Verwende SERVICE_ROLE_KEY aus Profil");
                    setServiceRoleKey(tempServiceRoleKey);
                    setFetchingServiceRoleKey(false);
                    setServiceRoleKeySubmitted(true);
                    setStep(4);
                    return;
                  } else {
                    const keyRef = extractProjectRefFromJwt(tempServiceRoleKey);
                    setServiceRoleKeyStatus(`\u26A0\uFE0F  Profil-Key geh\xF6rt zu ${keyRef}, nicht zu ${infraProjectRef}`);
                  }
                }
                setServiceRoleKeyStatus("\u26A0\uFE0F  Kein SERVICE_ROLE_KEY gefunden - bitte manuell eingeben");
                setFetchingServiceRoleKey(false);
                setStep(3);
              } catch (error) {
                setServiceRoleKeyStatus(`\u26A0\uFE0F  Fehler beim Abrufen: ${error.message}`);
                setFetchingServiceRoleKey(false);
                setStep(3);
              }
            } catch {
            }
          }
        }
      }
    ), fetchingServiceRoleKey && /* @__PURE__ */ React5.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React5.createElement(Spinner2, { type: "dots" }), /* @__PURE__ */ React5.createElement(Text, null, " ", serviceRoleKeyStatus)), serviceRoleKeyStatus && !fetchingServiceRoleKey && /* @__PURE__ */ React5.createElement(Text, { color: serviceRoleKeyStatus.startsWith("\u2713") ? "green" : "yellow", marginTop: 1 }, serviceRoleKeyStatus));
  }
  if (step === 3) {
    const cleanedInfraUrlForValidation = cleanUrl(infraUrl);
    const infraProjectRefForValidation = cleanedInfraUrlForValidation ? new URL(cleanedInfraUrlForValidation).hostname.split(".")[0] : null;
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "SERVICE_ROLE_KEY (f\xFCr INFRA-DB: ", infraProjectRefForValidation, "):"), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, "Der Key muss zur INFRA-DB passen, nicht zur DEV-DB!"), /* @__PURE__ */ React5.createElement(
      TextInput,
      {
        value: serviceRoleKey,
        onChange: setServiceRoleKey,
        mask: "*",
        onSubmit: (value) => {
          if (value.trim()) {
            if (infraProjectRefForValidation && !isKeyForProject(value.trim(), infraProjectRefForValidation)) {
              const keyRef = extractProjectRefFromJwt(value.trim());
              setServiceRoleKeyStatus(`\u26A0\uFE0F  WARNUNG: Key geh\xF6rt zu "${keyRef}", nicht zu "${infraProjectRefForValidation}"!`);
            }
            setServiceRoleKeySubmitted(true);
            setStep(4);
          }
        }
      }
    ), serviceRoleKeyStatus && /* @__PURE__ */ React5.createElement(Text, { color: "yellow" }, serviceRoleKeyStatus));
  }
  if (step === 4) {
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "Projektname:"), /* @__PURE__ */ React5.createElement(
      TextInput,
      {
        value: projectName,
        onChange: setProjectName,
        onSubmit: (value) => {
          if (value.trim() && /^[a-z0-9-]+$/.test(value)) {
            setProjectNameSubmitted(true);
            setStep(5);
          }
        }
      }
    ));
  }
  if (step === 5) {
    const defaultPath = process.cwd();
    const calculateFullPath = (inputPath) => {
      if (!inputPath || !inputPath.trim()) {
        return path6.resolve(defaultPath, projectName);
      }
      if (path6.isAbsolute(inputPath.trim())) {
        return path6.resolve(inputPath.trim(), projectName);
      }
      return path6.resolve(defaultPath, inputPath.trim(), projectName);
    };
    const fullPath = calculateFullPath(installPath);
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "Installationsordner:"), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, "Aktuelles Verzeichnis: ", defaultPath), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, "Leer lassen f\xFCr: ", defaultPath), /* @__PURE__ */ React5.createElement(
      TextInput,
      {
        value: installPath,
        onChange: setInstallPath,
        onSubmit: (value) => {
          setInstallPathSubmitted(true);
          setStep(6);
        }
      }
    ), /* @__PURE__ */ React5.createElement(Text, { color: "gray", marginTop: 1 }, "Vollst\xE4ndiger Pfad: ", fullPath));
  }
  if (step === 6) {
    if (fetchingDbPassword) {
      return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "DB-Passwort (optional):"), /* @__PURE__ */ React5.createElement(Box, null, /* @__PURE__ */ React5.createElement(Text, { color: "yellow" }, /* @__PURE__ */ React5.createElement(Spinner2, { type: "dots" })), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, " Suche Passwort im Vault...")));
    }
    if (dbPasswordFromVault && dbPassword && !dbPasswordSubmitted) {
      setTimeout(() => {
        setDbPasswordSubmitted(true);
        setStep(7);
      }, 500);
      return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "DB-Passwort (optional):"), /* @__PURE__ */ React5.createElement(Text, { color: "green" }, "\u2713 Aus Vault geladen (SUPABASE_DB_PASSWORD)"), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, "Passwort: ", dbPassword.substring(0, 4), "*".repeat(Math.max(0, dbPassword.length - 4))), /* @__PURE__ */ React5.createElement(Text, { color: "green", marginTop: 1 }, "\u2192 Wird automatisch \xFCbernommen..."));
    }
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "DB-Passwort (optional):"), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, "F\xFCr automatische Schema-Konfiguration (PostgREST)"), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, "Leer lassen = sp\xE4ter manuell via Migration"), /* @__PURE__ */ React5.createElement(
      TextInput,
      {
        value: dbPassword,
        onChange: setDbPassword,
        onSubmit: (value) => {
          if (value.trim()) {
            setDbPassword(value.trim());
          }
          setDbPasswordSubmitted(true);
          setStep(7);
        }
      }
    ), /* @__PURE__ */ React5.createElement(Text, { color: "gray", marginTop: 1 }, dbPassword ? "\u2713 Passwort eingegeben - Enter zum Fortfahren" : "Leer lassen = Migration-Datei wird erstellt"));
  }
  if (step === 7) {
    const githubOptions = [
      { label: "Ja, privat", value: "private" },
      { label: "Ja, \xF6ffentlich", value: "public" },
      { label: "Nein, nur lokal", value: "none" }
    ];
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "GitHub Repository erstellen?"), /* @__PURE__ */ React5.createElement(
      SelectInput,
      {
        items: githubOptions,
        onSelect: (item) => {
          setCreateGithub(item.value);
          setStep(8);
        }
      }
    ));
  }
  if (step === 8) {
    const yesNoOptions = [
      { label: "Ja", value: true },
      { label: "Nein", value: false }
    ];
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "Dependencies automatisch installieren?"), /* @__PURE__ */ React5.createElement(
      SelectInput,
      {
        items: yesNoOptions,
        initialSelectedIndex: 0,
        onSelect: (item) => {
          setAutoInstallDeps(item.value);
          setStep(9);
        }
      }
    ));
  }
  if (step === 9) {
    const yesNoOptions = [
      { label: "Ja", value: true },
      { label: "Nein", value: false }
    ];
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "Mit Vercel verkn\xFCpfen?"), /* @__PURE__ */ React5.createElement(
      SelectInput,
      {
        items: yesNoOptions,
        initialSelectedIndex: 1,
        onSelect: (item) => {
          setLinkVercel(item.value);
          setStep(10);
        }
      }
    ));
  }
  if (step === 10) {
    const yesNoOptions = [
      { label: "Ja", value: true },
      { label: "Nein", value: false }
    ];
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "Initial Commit erstellen?"), /* @__PURE__ */ React5.createElement(
      SelectInput,
      {
        items: yesNoOptions,
        initialSelectedIndex: 0,
        onSelect: (item) => {
          setDoInitialCommit(item.value);
          setStep(11);
        }
      }
    ));
  }
  if (step === 11) {
    const yesNoOptions = [
      { label: "Ja", value: true },
      { label: "Nein", value: false }
    ];
    const defaultIndex = createGithub !== "none" && doInitialCommit ? 0 : 1;
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "\xC4nderungen zu GitHub pushen?"), /* @__PURE__ */ React5.createElement(
      SelectInput,
      {
        items: yesNoOptions,
        initialSelectedIndex: defaultIndex,
        onSelect: (item) => {
          setDoPush(item.value);
          setStep(12);
        }
      }
    ));
  }
  if (step === 12) {
    const yesNoOptions = [
      { label: "Ja, Dev-Server starten", value: true },
      { label: "Nein, nur Projekt erstellen", value: false }
    ];
    return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "Dev-Server nach Erstellung starten?"), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, "Startet `pnpm dev` im Projekt-Verzeichnis"), /* @__PURE__ */ React5.createElement(
      SelectInput,
      {
        items: yesNoOptions,
        initialSelectedIndex: 0,
        onSelect: (item) => {
          setStartDevServer(item.value);
          handleComplete({ startDevServer: item.value });
        }
      }
    ));
  }
  return null;
}
var STEP_TITLES, TOTAL_STEPS;
var init_Wizard = __esm({
  "src/components/Wizard.jsx"() {
    init_WizardProgress();
    STEP_TITLES = [
      "Username eingeben",
      "INFRA-DB URL eingeben",
      "DEV-DB URL eingeben",
      "SERVICE_ROLE_KEY eingeben",
      "Projektname eingeben",
      "Installationsordner eingeben",
      "DB-Passwort eingeben (optional)",
      "GitHub Repository konfigurieren",
      "Dependencies-Installation konfigurieren",
      "Vercel-Verkn\xFCpfung konfigurieren",
      "Initial Commit konfigurieren",
      "Push konfigurieren",
      "Dev-Server konfigurieren"
    ];
    TOTAL_STEPS = 13;
  }
});
function Success({ config, ctx, projectPath }) {
  const { exit } = useApp();
  const [devServerStarting, setDevServerStarting] = useState(false);
  useEffect(() => {
    if (config.startDevServer && !devServerStarting) {
      setDevServerStarting(true);
      const timer = setTimeout(() => {
        exit();
        console.log(`
\u{1F680} Starte Dev-Server in ${projectPath}...
`);
        const devCmd = ctx.packageManager?.name === "npm" ? "npm" : "pnpm";
        const devProcess = spawn(devCmd, ["run", "dev"], {
          cwd: projectPath,
          stdio: "inherit",
          shell: true
        });
        devProcess.on("error", (err) => {
          console.error(`
\u274C Fehler beim Starten des Dev-Servers: ${err.message}`);
          process.exit(1);
        });
        devProcess.on("close", (code) => {
          process.exit(code || 0);
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [config.startDevServer, devServerStarting, exit, projectPath, ctx.packageManager]);
  return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React5.createElement(Text, { color: "green", bold: true }, `\u2728 Projekt "${config.projectName}" erfolgreich erstellt!`), config.startDevServer ? /* @__PURE__ */ React5.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "\u{1F680} Dev-Server wird gestartet..."), /* @__PURE__ */ React5.createElement(Text, { color: "white" }, `  \u2192 http://localhost:3000`)) : /* @__PURE__ */ React5.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React5.createElement(Text, { color: "cyan", bold: true }, "\u{1F4CB} N\xE4chste Schritte:"), /* @__PURE__ */ React5.createElement(Text, { color: "white" }, `  1. cd ${config.projectName}`), ctx.migrationPending && /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement(Text, { color: "yellow" }, `  2. export SUPABASE_DB_PASSWORD=dein-password`), /* @__PURE__ */ React5.createElement(Text, { color: "yellow" }, `  3. pnpm db:migrate`), /* @__PURE__ */ React5.createElement(Text, { color: "white" }, `  4. pnpm dev`)), !ctx.migrationPending && /* @__PURE__ */ React5.createElement(Text, { color: "white" }, `  2. pnpm dev`), /* @__PURE__ */ React5.createElement(Text, { color: "white" }, `  \u2192 http://localhost:3000`)), /* @__PURE__ */ React5.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React5.createElement(Text, { color: "gray", bold: true }, "\u{1F4DD} Projekt-Details:"), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, `  Schema: ${config.schemaName}`), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, `  INFRA-DB: ${config.infraDb?.projectRef || "N/A"}`), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, `  DEV-DB: ${config.devDb?.projectRef || "N/A"}`), ctx.repoUrl && /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, `  GitHub: ${ctx.repoUrl}`)), ctx.logFilePath && /* @__PURE__ */ React5.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React5.createElement(Text, { color: "gray", bold: true }, "\u{1F4C4} Log-Datei:"), /* @__PURE__ */ React5.createElement(Text, { color: "gray" }, `  ${ctx.logFilePath}`)), !config.startDevServer && /* @__PURE__ */ React5.createElement(Text, { color: "green", bold: true, marginTop: 1 }, `
\u{1F680} Happy Coding!
`));
}
var init_Success = __esm({
  "src/components/Success.jsx"() {
  }
});
function updateProgress(progressBar, value, status = null) {
  if (progressBar && typeof progressBar.update === "function") {
    progressBar.update(value, status);
  }
}
var init_progress = __esm({
  "lib/progress.js"() {
  }
});
function isGitHubCLIInstalled() {
  try {
    execSync("gh --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
function isGitHubCLIAuthenticated() {
  try {
    const token = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: "pipe"
    }).trim();
    return token && token.length > 0;
  } catch {
    return false;
  }
}
async function checkGitHubCLI(progressBar = null, silent = false) {
  if (!silent) {
    updateProgress(progressBar, null, "Pr\xFCfe GitHub CLI...");
  }
  if (!isGitHubCLIInstalled()) {
    if (!silent) {
      console.log(chalk11.yellow("\n\u26A0\uFE0F  GitHub CLI nicht gefunden"));
      const { install } = await inquirer.prompt([
        {
          type: "confirm",
          name: "install",
          message: "M\xF6chtest du GitHub CLI jetzt installieren? (Siehe: https://cli.github.com/)",
          default: false
        }
      ]);
      if (!install) {
        throw new Error("GitHub CLI ist erforderlich. Bitte installiere es manuell.");
      }
    }
    throw new Error(
      "GitHub CLI ist nicht installiert.\nSiehe: https://cli.github.com/manual/installation"
    );
  }
  if (!silent) {
    updateProgress(progressBar, null, "Pr\xFCfe GitHub Authentifizierung...");
  }
  if (!isGitHubCLIAuthenticated()) {
    if (!silent) {
      console.log(chalk11.yellow("\n\u26A0\uFE0F  GitHub CLI nicht authentifiziert"));
      const { login } = await inquirer.prompt([
        {
          type: "confirm",
          name: "login",
          message: "M\xF6chtest du dich jetzt bei GitHub anmelden?",
          default: true
        }
      ]);
      if (login) {
        console.log(chalk11.blue("\xD6ffne GitHub Login..."));
        try {
          execSync("gh auth login", { stdio: "inherit" });
        } catch (error) {
          throw new Error(`GitHub Login fehlgeschlagen: ${error.message}`);
        }
      } else {
        throw new Error("GitHub Authentifizierung ist erforderlich.");
      }
    } else {
      throw new Error("GitHub CLI ist nicht authentifiziert. Bitte f\xFChre 'gh auth login' aus.");
    }
  }
  if (!silent) {
    updateProgress(progressBar, null, "GitHub Token abrufen...");
  }
  try {
    const token = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: "pipe"
    }).trim();
    if (!token || token.length === 0) {
      throw new Error("GitHub Token konnte nicht abgerufen werden");
    }
    return token;
  } catch (error) {
    throw new Error(`Fehler beim Abrufen des GitHub Tokens: ${error.message}`);
  }
}
function isVercelCLIInstalled() {
  try {
    execSync("vercel --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
function isVercelCLIAuthenticated() {
  try {
    execSync("vercel whoami", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
async function checkVercelCLI(progressBar = null) {
  updateProgress(progressBar, null, "Pr\xFCfe Vercel CLI...");
  if (!isVercelCLIInstalled()) {
    console.log(chalk11.yellow("\n\u26A0\uFE0F  Vercel CLI nicht gefunden"));
    const { install } = await inquirer.prompt([
      {
        type: "confirm",
        name: "install",
        message: "M\xF6chtest du Vercel CLI jetzt installieren? (npm install -g vercel)",
        default: false
      }
    ]);
    if (install) {
      console.log(chalk11.blue("Installiere Vercel CLI..."));
      try {
        execSync("npm install -g vercel", { stdio: "inherit" });
      } catch (error) {
        throw new Error(`Vercel CLI Installation fehlgeschlagen: ${error.message}`);
      }
    } else {
      console.log(chalk11.dim("Vercel CLI wird \xFCbersprungen (optional)"));
      return;
    }
  }
  updateProgress(progressBar, null, "Pr\xFCfe Vercel Authentifizierung...");
  if (!isVercelCLIAuthenticated()) {
    console.log(chalk11.yellow("\n\u26A0\uFE0F  Vercel CLI nicht authentifiziert"));
    const { login } = await inquirer.prompt([
      {
        type: "confirm",
        name: "login",
        message: "M\xF6chtest du dich jetzt bei Vercel anmelden?",
        default: false
      }
    ]);
    if (login) {
      console.log(chalk11.blue("\xD6ffne Vercel Login..."));
      try {
        execSync("vercel login", { stdio: "inherit" });
      } catch (error) {
        console.log(chalk11.yellow("\u26A0\uFE0F  Vercel Login fehlgeschlagen (optional)"));
      }
    }
  }
  updateProgress(progressBar, null, "Vercel CLI bereit");
}
function isPnpmInstalled() {
  try {
    execSync("pnpm --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
function isNpmInstalled() {
  try {
    execSync("npm --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
async function checkPackageManager(progressBar = null, silent = false) {
  if (!silent) {
    updateProgress(progressBar, null, "Pr\xFCfe Package Manager...");
  }
  if (isPnpmInstalled()) {
    const version = execSync("pnpm --version", { encoding: "utf-8", stdio: "pipe" }).trim();
    if (!silent) {
      console.log(chalk11.green(`\u2713 pnpm gefunden (Version ${version})`));
      updateProgress(progressBar, null, "pnpm bereit");
    }
    return {
      name: "pnpm",
      command: "pnpm",
      installCommand: "pnpm install",
      devCommand: "pnpm dev"
    };
  }
  if (isNpmInstalled()) {
    const version = execSync("npm --version", { encoding: "utf-8", stdio: "pipe" }).trim();
    if (!silent) {
      console.log(chalk11.yellow(`\u26A0\uFE0F  pnpm nicht gefunden, verwende npm (Version ${version})`));
      console.log(chalk11.dim("   Tipp: pnpm wird empfohlen. Installiere mit: npm install -g pnpm"));
      updateProgress(progressBar, null, "npm bereit");
    }
    return {
      name: "npm",
      command: "npm",
      installCommand: "npm install",
      devCommand: "npm run dev"
    };
  }
  throw new Error(
    "Weder pnpm noch npm gefunden. Bitte installiere einen Package Manager:\n  - pnpm: npm install -g pnpm (empfohlen)\n  - npm: sollte mit Node.js installiert sein"
  );
}
function isSupabaseCLIInstalled() {
  try {
    execSync("supabase --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
async function checkSupabaseCLI(progressBar = null, silent = false) {
  if (!silent) {
    updateProgress(progressBar, null, "Pr\xFCfe Supabase CLI...");
  }
  if (!isSupabaseCLIInstalled()) {
    if (!silent) {
      console.log(chalk11.yellow("\n\u26A0\uFE0F  Supabase CLI nicht gefunden"));
      const { install } = await inquirer.prompt([
        {
          type: "confirm",
          name: "install",
          message: "M\xF6chtest du Supabase CLI jetzt installieren? (Siehe: https://supabase.com/docs/guides/cli)",
          default: false
        }
      ]);
      if (!install) {
        throw new Error("Supabase CLI ist erforderlich. Bitte installiere es manuell.");
      }
    }
    throw new Error(
      "Supabase CLI ist nicht installiert.\nSiehe: https://supabase.com/docs/guides/cli/getting-started"
    );
  }
  if (!silent) {
    updateProgress(progressBar, null, "Supabase CLI bereit");
  }
}
var init_prechecks = __esm({
  "lib/prechecks.js"() {
    init_profile();
    init_progress();
  }
});
function createPrecheckTasks(config, options = {}) {
  const { verbose } = options;
  const debug = (ctx, msg) => {
    if (verbose && ctx.debug) {
      ctx.debug(msg);
    }
  };
  const taskDefinitions = [
    {
      title: "GitHub CLI",
      task: async (ctx, task) => {
        try {
          debug(ctx, "Pr\xFCfe GitHub CLI...");
          ctx.githubToken = await checkGitHubCLI(null, true);
          debug(ctx, `GitHub Token: ${ctx.githubToken ? "OK" : "fehlt"}`);
          task.title = "GitHub CLI \u2713";
        } catch (error) {
          debug(ctx, `GitHub CLI Fehler: ${error.message}`);
          task.title = `GitHub CLI \u2717 (${error.message})`;
          throw error;
        }
      },
      enabled: () => true
    },
    {
      title: "Vercel CLI",
      task: async (ctx, task) => {
        try {
          await checkVercelCLI(null, true);
          ctx.vercelInstalled = true;
          task.title = "Vercel CLI \u2713";
        } catch (error) {
          ctx.vercelInstalled = false;
          task.title = "Vercel CLI (optional)";
        }
      },
      skip: () => !config.linkVercel
    },
    {
      title: "Supabase CLI",
      task: async (ctx, task) => {
        try {
          await checkSupabaseCLI(null, true);
          task.title = "Supabase CLI \u2713";
        } catch (error) {
          task.title = `Supabase CLI \u2717 (${error.message})`;
          throw error;
        }
      }
    },
    {
      title: "Package Manager",
      task: async (ctx, task) => {
        try {
          ctx.packageManager = await checkPackageManager(null, true);
          task.title = `Package Manager: ${ctx.packageManager.name} \u2713`;
        } catch (error) {
          task.title = `Package Manager \u2717 (${error.message})`;
          throw error;
        }
      }
    },
    {
      title: "INFRA-DB Verbindung",
      task: async (ctx, task) => {
        try {
          const supabase = createClient(config.infraDb.url, config.serviceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          });
          const response = await fetch(`${config.infraDb.url}/rest/v1/`, {
            method: "GET",
            headers: { apikey: "test" }
          });
          if (response.status !== 401 && response.status !== 200) {
            throw new Error(`INFRA-DB antwortet mit Status ${response.status}`);
          }
          task.title = "INFRA-DB Verbindung \u2713";
        } catch (error) {
          task.title = "INFRA-DB Verbindung \u2717";
          throw error;
        }
      }
    },
    {
      title: "DEV-DB Verbindung",
      task: async (ctx, task) => {
        try {
          const response = await fetch(`${config.devDb.url}/rest/v1/`, {
            method: "GET",
            headers: { apikey: "test" }
          });
          if (response.status !== 401 && response.status !== 200) {
            throw new Error(`DEV-DB antwortet mit Status ${response.status}`);
          }
          task.title = "DEV-DB Verbindung \u2713";
        } catch (error) {
          task.title = "DEV-DB Verbindung \u2717";
          throw error;
        }
      }
    }
  ];
  return {
    tasks: taskDefinitions,
    listr: new Listr(taskDefinitions, {
      concurrent: false,
      renderer: "verbose",
      rendererOptions: {
        collapseSubtasks: false,
        showTimer: false,
        clearOutput: false,
        formatOutput: "default",
        showSubtasks: true,
        collapse: false
      }
    })
  };
}
var init_phase1_prechecks = __esm({
  "src/tasks/phase1-prechecks.js"() {
    init_prechecks();
  }
});
function createSetupTasks(config, options = {}) {
  const { verbose } = options;
  const debug = (ctx, msg) => {
    if (verbose && ctx.debug) {
      ctx.debug(msg);
    }
  };
  const taskDefinitions = [
    {
      title: "Schema-Name generieren",
      task: (ctx, task) => {
        ctx.schemaName = config.schemaName;
        debug(ctx, `Schema-Name: ${ctx.schemaName}`);
        task.title = `Schema-Name: ${ctx.schemaName} \u2713`;
      }
    },
    {
      title: "Anon Key von INFRA-DB abrufen",
      task: async (ctx, task) => {
        const debugFn = (msg) => {
          debug(ctx, msg);
        };
        debug(ctx, `Hole Anon Key f\xFCr: ${config.infraDb.projectRef}`);
        ctx.anonKey = await fetchAnonKeyFromSupabase(config.infraDb.projectRef, debugFn);
        if (!ctx.anonKey) {
          debug(ctx, "Anon Key nicht gefunden");
          task.title = "Anon Key von INFRA-DB abrufen \u26A0 (manuell erforderlich)";
        } else {
          debug(ctx, `Anon Key: ${ctx.anonKey.substring(0, 20)}...`);
          task.title = "Anon Key von INFRA-DB abgerufen \u2713";
        }
      }
    },
    {
      title: "Service Role Key von INFRA-DB abrufen",
      task: async (ctx, task) => {
        const debugFn = (msg) => {
          debug(ctx, msg);
        };
        debug(ctx, `Hole Service Role Key f\xFCr: ${config.infraDb.projectRef}`);
        ctx.serviceRoleKey = await fetchServiceRoleKeyFromSupabase(config.infraDb.projectRef, debugFn);
        if (!ctx.serviceRoleKey) {
          debug(ctx, "Service Role Key nicht gefunden, verwende Config");
          ctx.serviceRoleKey = config.serviceRoleKey;
          task.title = "Service Role Key verwendet (aus Config) \u2713";
        } else {
          debug(ctx, `Service Role Key: ${ctx.serviceRoleKey.substring(0, 20)}...`);
          task.title = "Service Role Key von INFRA-DB abgerufen \u2713";
        }
      }
    }
  ];
  return {
    tasks: taskDefinitions,
    listr: new Listr(taskDefinitions, {
      concurrent: false,
      renderer: "verbose",
      rendererOptions: {
        collapseSubtasks: false,
        showTimer: false,
        clearOutput: false,
        formatOutput: "default"
      }
    })
  };
}
var init_phase2_setup = __esm({
  "src/tasks/phase2-setup.js"() {
    init_supabase();
  }
});
function initLog(projectPath, projectName) {
  const logsDir = path6.join(projectPath, ".kessel");
  if (!fs6.existsSync(logsDir)) {
    fs6.mkdirSync(logsDir, { recursive: true });
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  logPath = path6.join(logsDir, `creation-${timestamp}.log`);
  logFile = fs6.createWriteStream(logPath, { flags: "a" });
  logFile.write(`# Kessel CLI - Projekt-Erstellung Log
`);
  logFile.write(`# Projekt: ${projectName}
`);
  logFile.write(`# Erstellt: ${(/* @__PURE__ */ new Date()).toISOString()}
`);
  logFile.write(`# ================================================

`);
}
function writeLog(message, level = "INFO") {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const line = `[${timestamp}] [${level}] ${message}
`;
  if (logFile && !logClosed && logFile.writable) {
    try {
      logFile.write(line);
    } catch (e) {
    }
  }
}
function closeLog() {
  if (logFile && !logClosed) {
    try {
      logFile.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] [INFO] Log abgeschlossen
`);
      logFile.end();
    } catch (e) {
    }
    logClosed = true;
  }
  return logPath;
}
function withTimeout(promise, ms, operation) {
  return Promise.race([
    promise,
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`Timeout nach ${ms}ms bei: ${operation}`)), ms)
    )
  ]);
}
function createProjectTasks(config, ctx, projectPath, options = {}) {
  const { verbose, dryRun } = options;
  const finalProjectPath = projectPath || config?.projectPath;
  if (!finalProjectPath) {
    throw new Error("projectPath ist nicht gesetzt! Bitte Installationsordner im Wizard angeben.");
  }
  let logInitialized = false;
  const debug = (taskCtx, msg) => {
    if (logInitialized) {
      writeLog(msg, "DEBUG");
    }
    if (verbose) {
      if (taskCtx && taskCtx.debug) {
        taskCtx.debug(msg);
      } else {
        const timestamp = (/* @__PURE__ */ new Date()).toISOString().split("T")[1].split(".")[0];
        console.log(`[${timestamp}] ${msg}`);
      }
    }
  };
  const initializeLog = () => {
    try {
      initLog(finalProjectPath, config.projectName);
      writeLog(`Starte Projekt-Erstellung: ${config.projectName}`);
      writeLog(`Pfad: ${finalProjectPath}`);
      writeLog(`INFRA-DB: ${config.infraDb.url}`);
      writeLog(`DEV-DB: ${config.devDb.url}`);
      writeLog(`Schema: ${config.schemaName}`);
      writeLog(`GitHub: ${config.createGithub}`);
      logInitialized = true;
    } catch (e) {
      if (verbose) {
        console.log(`[WARN] Log konnte nicht initialisiert werden: ${e.message}`);
      }
    }
  };
  const taskDefinitions = [
    {
      title: "1/13: GitHub Repository erstellen",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: GitHub Repository w\xFCrde erstellt werden`);
          task.title = "1/13: GitHub Repository (DRY-RUN) \u2713";
          return Promise.resolve();
        }
        writeLog(`Task 1/13: GitHub Repository`, "TASK");
        debug(taskCtx, `\u{1F680} GitHub Task gestartet`);
        debug(taskCtx, `createGithub: ${config.createGithub}`);
        debug(taskCtx, `projectName: ${config.projectName}`);
        if (config.createGithub === "none") {
          debug(taskCtx, `GitHub \xFCbersprungen (config.createGithub === 'none')`);
          writeLog(`GitHub \xFCbersprungen`, "SKIP");
          task.skip("GitHub Repo-Erstellung \xFCbersprungen");
          return;
        }
        if (!ctx.githubToken) {
          debug(taskCtx, `GitHub Token fehlt - \xFCberspringe Repository-Erstellung`);
          task.title = "1/13: GitHub Repository \u26A0 (Token fehlt - manuell erstellen)";
          return;
        }
        try {
          debug(taskCtx, `GitHub Token vorhanden: ${!!ctx.githubToken}`);
          debug(taskCtx, `Token-L\xE4nge: ${ctx.githubToken ? ctx.githubToken.length : 0}`);
          debug(taskCtx, `Erstelle Octokit Client...`);
          const octokit = new Octokit({
            auth: ctx.githubToken,
            request: {
              timeout: 3e4
              // 30 Sekunden Timeout
            }
          });
          debug(taskCtx, `Hole User-Daten von GitHub API (Timeout: 30s)...`);
          const { data: userData } = await withTimeout(
            octokit.rest.users.getAuthenticated(),
            3e4,
            "GitHub User-Authentifizierung"
          );
          debug(taskCtx, `\u2713 User: ${userData.login}`);
          writeLog(`GitHub User: ${userData.login}`);
          debug(taskCtx, `Pr\xFCfe ob Repo existiert: ${userData.login}/${config.projectName}`);
          try {
            const { data: existingRepo } = await withTimeout(
              octokit.rest.repos.get({
                owner: userData.login,
                repo: config.projectName
              }),
              15e3,
              "GitHub Repo-Check"
            );
            ctx.repoUrl = existingRepo.html_url;
            debug(taskCtx, `\u2713 Repo existiert bereits: ${existingRepo.html_url}`);
            writeLog(`Repo existiert: ${existingRepo.html_url}`, "OK");
            task.title = `1/13: GitHub Repository existiert bereits \u2713 (${existingRepo.html_url})`;
            return;
          } catch (e) {
            if (e.status !== 404 && !e.message.includes("Timeout")) {
              debug(taskCtx, `\u2717 Unerwarteter Fehler beim Pr\xFCfen: ${e.status} - ${e.message}`);
              throw e;
            }
            if (e.message.includes("Timeout")) {
              debug(taskCtx, `\u26A0 Timeout beim Pr\xFCfen, versuche trotzdem zu erstellen...`);
            } else {
              debug(taskCtx, `Repo existiert nicht (404), wird erstellt...`);
            }
          }
          debug(taskCtx, `Erstelle neues Repo: ${config.projectName} (private: ${config.createGithub === "private"})`);
          const { data: repo } = await withTimeout(
            octokit.rest.repos.createForAuthenticatedUser({
              name: config.projectName,
              private: config.createGithub === "private",
              auto_init: false
            }),
            3e4,
            "GitHub Repo-Erstellung"
          );
          ctx.repoUrl = repo.html_url;
          debug(taskCtx, `\u2713 Repo erstellt: ${repo.html_url}`);
          writeLog(`Repo erstellt: ${repo.html_url}`, "OK");
          task.title = `1/13: GitHub Repository erstellt \u2713 (${repo.html_url})`;
        } catch (error) {
          debug(taskCtx, `\u2717 GitHub Fehler: ${error.message}`);
          writeLog(`GitHub Fehler: ${error.message}`, "ERROR");
          if (error.message.includes("Timeout")) {
            task.title = `1/13: GitHub Repository \u26A0 (Timeout - manuell pr\xFCfen)`;
            return;
          }
          if (error.message.includes("already exists") || error.status === 422) {
            task.title = `1/13: GitHub Repository existiert bereits \u26A0`;
            return;
          }
          task.title = `1/13: GitHub Repository \u2717 (${error.message})`;
          throw error;
        }
      }
    },
    {
      title: "2/13: Template klonen",
      task: async (taskCtx, task) => {
        debug(taskCtx, `Pr\xFCfe Zielverzeichnis: ${finalProjectPath}`);
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Template w\xFCrde geklont werden nach ${finalProjectPath}`);
          task.title = "2/13: Template klonen (DRY-RUN) \u2713";
          return;
        }
        if (fs6.existsSync(finalProjectPath)) {
          const files = fs6.readdirSync(finalProjectPath);
          if (files.length > 0) {
            debug(taskCtx, `Verzeichnis existiert bereits mit ${files.length} Dateien`);
            if (fs6.existsSync(path6.join(finalProjectPath, "package.json"))) {
              debug(taskCtx, `Bestehendes Kessel-Projekt gefunden, \xFCberspringe Klonen`);
              task.title = "2/13: Bestehendes Projekt verwendet \u2713";
              initializeLog();
              return;
            }
          }
        }
        try {
          const templateRepo = "phkoenig/kessel-boilerplate";
          const gitUrl = `https://${ctx.githubToken}@github.com/${templateRepo}.git`;
          debug(taskCtx, `Git clone: ${templateRepo} \u2192 ${finalProjectPath}`);
          execSync(
            `git clone --depth 1 --branch main ${gitUrl} ${finalProjectPath}`,
            {
              stdio: "pipe",
              env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: "0"
              }
            }
          );
          const gitPath = path6.join(finalProjectPath, ".git");
          if (fs6.existsSync(gitPath)) {
            fs6.rmSync(gitPath, { recursive: true, force: true });
          }
          debug(taskCtx, `Template erfolgreich geklont`);
          const pkgPath = path6.join(finalProjectPath, "package.json");
          if (fs6.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs6.readFileSync(pkgPath, "utf8"));
            pkg.name = config.projectName;
            pkg.version = "0.1.0";
            fs6.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
            debug(taskCtx, `package.json aktualisiert: name=${config.projectName}`);
          }
          task.title = "2/13: Template geklont \u2713";
          initializeLog();
        } catch (error) {
          debug(taskCtx, `Git clone fehlgeschlagen: ${error.message}`);
          try {
            const templateRepo = "phkoenig/kessel-boilerplate";
            debug(taskCtx, `Versuche degit Fallback...`);
            const emitter = degit(`${templateRepo}#main`, {
              cache: false,
              force: true
            });
            await emitter.clone(finalProjectPath);
            debug(taskCtx, `Degit erfolgreich`);
            const pkgPath = path6.join(finalProjectPath, "package.json");
            if (fs6.existsSync(pkgPath)) {
              const pkg = JSON.parse(fs6.readFileSync(pkgPath, "utf8"));
              pkg.name = config.projectName;
              pkg.version = "0.1.0";
              fs6.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
              debug(taskCtx, `package.json aktualisiert: name=${config.projectName}`);
            }
            task.title = "2/13: Template geklont (degit) \u2713";
            initializeLog();
          } catch (degitError) {
            debug(taskCtx, `Degit auch fehlgeschlagen: ${degitError.message}`);
            task.title = `2/13: Template klonen \u2717`;
            throw new Error(`Git: ${error.message}, Degit: ${degitError.message}`);
          }
        }
      }
    },
    {
      title: "3/13: Bootstrap-Credentials (.env)",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: .env w\xFCrde erstellt werden`);
          task.title = "3/13: .env (DRY-RUN) \u2713";
          return;
        }
        const envContent = `# Bootstrap-Credentials f\xFCr Vault-Zugriff (INFRA-DB)
# WICHTIG: Dies ist die URL der INFRA-DB (Kessel) mit integriertem Vault
NEXT_PUBLIC_SUPABASE_URL=${config.infraDb.url}
SERVICE_ROLE_KEY=${config.serviceRoleKey}
`;
        fs6.writeFileSync(path6.join(finalProjectPath, ".env"), envContent);
        task.title = "3/13: .env erstellt \u2713";
      }
    },
    {
      title: "4/13: Public-Credentials (.env.local)",
      task: async (taskCtx, task) => {
        if (!ctx.anonKey) {
          ctx.anonKey = await fetchAnonKeyFromSupabase(config.infraDb.projectRef, () => {
          });
        }
        if (!ctx.anonKey) {
          throw new Error("Anon Key konnte nicht abgerufen werden");
        }
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: .env.local w\xFCrde erstellt werden`);
          task.title = "4/13: .env.local (DRY-RUN) \u2713";
          return;
        }
        const cleanAnonKey = ctx.anonKey.replace(/\x1b\[[0-9;]*m/g, "").replace(/\u001b\[\d+m/g, "").trim();
        const cleanServiceRoleKey = ctx.serviceRoleKey.replace(/\x1b\[[0-9;]*m/g, "").replace(/\u001b\[\d+m/g, "").trim();
        const appName = config.projectName.split(/[-_]/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
        const envLocalContent = `# Public-Credentials f\xFCr Next.js Client
# Multi-Tenant Architektur: INFRA-DB (Auth, Vault) + DEV-DB (App-Daten)
# Tenant-Isolation erfolgt \xFCber RLS Policies basierend auf tenant_id im JWT

# App-Name (wird im UI angezeigt)
NEXT_PUBLIC_APP_NAME=${appName}

# INFRA-DB (Kessel) - Auth, Vault, Multi-Tenant
NEXT_PUBLIC_SUPABASE_URL=${config.infraDb.url}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${cleanAnonKey}
NEXT_PUBLIC_TENANT_SLUG=${config.schemaName}

# DEV-DB - App-Daten, Entwicklung
# Hinweis: Kann gleich INFRA-DB sein oder separate DB f\xFCr fachliche Daten
NEXT_PUBLIC_DEV_SUPABASE_URL=${config.devDb.url}

# Service Role Key f\xFCr Server-Side Operationen (User-Erstellung, etc.)
SUPABASE_SERVICE_ROLE_KEY=${cleanServiceRoleKey}

# \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
# Local Development Defaults
# \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
# Auth-Bypass aktiviert den DevUserSelector auf der Login-Seite
NEXT_PUBLIC_AUTH_BYPASS=true
`;
        fs6.writeFileSync(path6.join(finalProjectPath, ".env.local"), envLocalContent);
        task.title = "4/13: .env.local erstellt \u2713";
      }
    },
    {
      title: "5/13: Git initialisieren",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Git w\xFCrde initialisiert werden`);
          task.title = "5/13: Git initialisieren (DRY-RUN) \u2713";
          return;
        }
        const gitDir = path6.join(finalProjectPath, ".git");
        if (!fs6.existsSync(gitDir)) {
          execSync("git init -b main", { cwd: finalProjectPath, stdio: "ignore" });
        }
        if (ctx.repoUrl) {
          ctx.repoUrl.replace("https://", `https://${ctx.githubToken}@`);
          try {
            execSync("git remote remove origin", { cwd: finalProjectPath, stdio: "ignore" });
          } catch {
          }
          execSync(`git remote add origin ${ctx.repoUrl}`, {
            cwd: finalProjectPath,
            stdio: "ignore"
          });
        }
        task.title = "5/13: Git initialisiert \u2713";
      }
    },
    {
      title: "6/13: Dependencies installieren",
      task: async (taskCtx, task) => {
        if (!config.autoInstallDeps) {
          task.skip("Dependencies-Installation \xFCbersprungen");
          return;
        }
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Dependencies w\xFCrden installiert werden`);
          task.title = "6/13: Dependencies installieren (DRY-RUN) \u2713";
          return;
        }
        const installCmd = ctx.packageManager?.installCommand || "pnpm install";
        execSync(installCmd, { cwd: finalProjectPath, stdio: "inherit" });
        try {
          execSync("pnpm version:write", { cwd: finalProjectPath, stdio: "ignore" });
          debug(taskCtx, "version.ts generiert");
        } catch {
          debug(taskCtx, "version:write \xFCbersprungen (optional)");
        }
        task.title = "6/13: Dependencies installiert \u2713";
      },
      skip: () => !config.autoInstallDeps
    },
    {
      title: "7/13: Secrets aus Vault laden (pnpm pull-env)",
      task: async (taskCtx, task) => {
        if (!config.autoInstallDeps) {
          task.skip("\xDCbersprungen (keine Dependencies installiert)");
          return;
        }
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: pnpm pull-env w\xFCrde ausgef\xFChrt werden`);
          task.title = "7/13: Secrets aus Vault (DRY-RUN) \u2713";
          return;
        }
        try {
          debug(taskCtx, `F\xFChre pnpm pull-env aus...`);
          execSync("pnpm pull-env", {
            cwd: finalProjectPath,
            stdio: "pipe",
            env: {
              ...process.env,
              // Stelle sicher, dass die .env geladen wird
              NEXT_PUBLIC_SUPABASE_URL: config.infraDb.url,
              SERVICE_ROLE_KEY: ctx.serviceRoleKey
            }
          });
          debug(taskCtx, `Secrets erfolgreich aus Vault geladen`);
          writeLog(`Secrets aus Vault geladen (pnpm pull-env)`, "OK");
          task.title = "7/13: Secrets aus Vault geladen \u2713";
        } catch (error) {
          debug(taskCtx, `pull-env Fehler: ${error.message}`);
          writeLog(`pull-env Fehler: ${error.message}`, "WARN");
          task.title = "7/13: Secrets aus Vault \u26A0 (manuell: pnpm pull-env)";
        }
      },
      skip: () => !config.autoInstallDeps
    },
    {
      title: "8/13: Supabase Link",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Supabase w\xFCrde verlinkt werden`);
          task.title = "8/13: Supabase Link (DRY-RUN) \u2713";
          return;
        }
        try {
          execSync(`supabase link --project-ref ${config.infraDb.projectRef}`, {
            cwd: finalProjectPath,
            stdio: "pipe"
          });
          task.title = "8/13: INFRA-DB verlinkt \u2713";
        } catch (error) {
          task.title = "8/13: Supabase Link \u26A0 (nicht kritisch)";
        }
      }
    },
    {
      title: "9/13: Tenant erstellen",
      task: async (taskCtx, task) => {
        debug(taskCtx, `Erstelle Tenant: ${config.schemaName}`);
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Tenant w\xFCrde erstellt werden`);
          task.title = `9/13: Tenant "${config.schemaName}" (DRY-RUN) \u2713`;
          return;
        }
        if (!ctx.serviceRoleKey || !config.infraDb?.url) {
          debug(taskCtx, `Service Role Key oder INFRA-DB URL fehlt`);
          task.title = `9/13: Tenant erstellen \u26A0 (Service Role Key fehlt)`;
          ctx.tenantId = null;
          return;
        }
        try {
          const { createTenant: createTenant2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
          const tenantResult = await createTenant2(
            config.infraDb.url,
            ctx.serviceRoleKey,
            config.schemaName,
            // slug
            config.projectName,
            // name
            verbose
          );
          if (tenantResult.success && tenantResult.tenantId) {
            ctx.tenantId = tenantResult.tenantId;
            debug(taskCtx, `Tenant erstellt: ${tenantResult.tenantId}`);
            writeLog(`Tenant erstellt: ${config.schemaName} (${tenantResult.tenantId})`, "OK");
            try {
              const { copyDefaultTheme: copyDefaultTheme2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
              const themeResult = await copyDefaultTheme2(
                config.infraDb.url,
                ctx.serviceRoleKey,
                config.schemaName,
                verbose
              );
              if (themeResult.success) {
                const count = themeResult.copied?.length || 0;
                debug(taskCtx, `${count} Themes kopiert nach ${config.schemaName}/`);
                writeLog(`${count} Themes kopiert: ${themeResult.copied?.join(", ") || "keine"}`, "OK");
              } else {
                debug(taskCtx, `Theme-Kopieren fehlgeschlagen: ${themeResult.error}`);
              }
            } catch (themeError) {
              debug(taskCtx, `Theme-Warnung: ${themeError.message}`);
            }
            task.title = `9/13: Tenant "${config.schemaName}" erstellt \u2713`;
          } else {
            debug(taskCtx, `Tenant-Erstellung fehlgeschlagen: ${tenantResult.error}`);
            writeLog(`Tenant-Erstellung fehlgeschlagen: ${tenantResult.error}`, "ERROR");
            task.title = `9/13: Tenant erstellen \u2717 (${tenantResult.error})`;
            ctx.tenantId = null;
          }
        } catch (error) {
          debug(taskCtx, `Fehler bei Tenant-Erstellung: ${error.message}`);
          writeLog(`Fehler bei Tenant-Erstellung: ${error.message}`, "ERROR");
          task.title = `9/13: Tenant erstellen \u2717`;
          ctx.tenantId = null;
        }
      }
    },
    {
      title: "10/13: Datenbank-Migrationen",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Migrationen w\xFCrden ausgef\xFChrt werden`);
          task.title = "10/13: Migrationen (DRY-RUN) \u2713";
          return;
        }
        debug(taskCtx, `Migration-Script suchen...`);
        const migrationScript = path6.join(finalProjectPath, "scripts", "apply-migrations-to-schema.mjs");
        if (!fs6.existsSync(migrationScript)) {
          debug(taskCtx, `Migration-Script nicht gefunden: ${migrationScript}`);
          task.skip("Migration-Script nicht gefunden");
          return;
        }
        debug(taskCtx, `Migrationen brauchen DB_PASSWORD - \xFCberspringe automatische Ausf\xFChrung`);
        task.title = "10/13: Migrationen \u26A0 (manuell: pnpm db:migrate)";
        ctx.migrationPending = true;
      }
    },
    {
      title: "11/13: Standard-User pr\xFCfen und zu Tenant zuordnen",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Standard-User w\xFCrden erstellt werden`);
          task.title = "11/13: Standard-User (DRY-RUN) \u2713";
          return;
        }
        const createUsersScript = path6.join(finalProjectPath, "scripts", "create-test-users.mjs");
        if (!fs6.existsSync(createUsersScript)) {
          task.skip("User-Script nicht gefunden");
          return;
        }
        try {
          const userEnv = {
            ...process.env,
            NEXT_PUBLIC_SUPABASE_URL: config.infraDb.url,
            SUPABASE_SERVICE_ROLE_KEY: ctx.serviceRoleKey
          };
          execSync("node scripts/create-test-users.mjs", {
            cwd: finalProjectPath,
            stdio: "inherit",
            env: userEnv
          });
          if (ctx.tenantId && ctx.serviceRoleKey && config.infraDb?.url) {
            try {
              const { assignUserToTenant: assignUserToTenant2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
              debug(taskCtx, `User-Tenant-Zuordnung wird \xFCbersprungen (muss manuell erfolgen)`);
              writeLog(`User-Tenant-Zuordnung: Muss manuell erfolgen`, "INFO");
            } catch (assignError) {
              debug(taskCtx, `Fehler bei User-Tenant-Zuordnung: ${assignError.message}`);
              writeLog(`Fehler bei User-Tenant-Zuordnung: ${assignError.message}`, "WARN");
            }
          }
          task.title = "11/13: Standard-User erstellt \u2713";
        } catch (error) {
          task.title = "11/13: Standard-User \u26A0";
        }
      }
    },
    {
      title: "12/13: Vercel Link",
      task: async (taskCtx, task) => {
        if (!config.linkVercel) {
          task.skip("Vercel Link \xFCbersprungen");
          return;
        }
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Vercel w\xFCrde verlinkt werden`);
          task.title = "11/13: Vercel Link (DRY-RUN) \u2713";
          return;
        }
        try {
          execSync("vercel link --yes", {
            cwd: finalProjectPath,
            stdio: "pipe"
          });
          task.title = "11/13: Vercel verlinkt \u2713";
        } catch (error) {
          task.title = "11/13: Vercel Link \u26A0 (nicht kritisch)";
        }
      },
      skip: () => !config.linkVercel
    },
    {
      title: "13/13: MCP-Konfiguration aktualisieren",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: MCP-Konfiguration w\xFCrde aktualisiert werden`);
          task.title = "12/13: MCP-Konfiguration (DRY-RUN) \u2713";
          return;
        }
        const mcpConfigPath = path6.join(finalProjectPath, ".cursor", "mcp.json");
        const cursorDir = path6.join(finalProjectPath, ".cursor");
        if (!fs6.existsSync(cursorDir)) {
          fs6.mkdirSync(cursorDir, { recursive: true });
        }
        let mcpConfig = { mcpServers: {} };
        if (fs6.existsSync(mcpConfigPath)) {
          mcpConfig = JSON.parse(fs6.readFileSync(mcpConfigPath, "utf-8"));
        }
        const supabaseKeys = Object.keys(mcpConfig.mcpServers || {}).filter((key) => key.toLowerCase().includes("supabase"));
        for (const key of supabaseKeys) {
          delete mcpConfig.mcpServers[key];
        }
        const mcpServerName = `supabase_DEV_${config.schemaName}`;
        mcpConfig.mcpServers[mcpServerName] = {
          type: "http",
          url: `https://mcp.supabase.com/mcp?project_ref=${config.devDb.projectRef}`
        };
        fs6.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
        task.title = "12/13: MCP-Konfiguration aktualisiert \u2713";
      }
    },
    {
      title: "Log abschlie\xDFen",
      task: async (taskCtx, task) => {
        writeLog(`
# ================================================`, "INFO");
        writeLog(`# ZUSAMMENFASSUNG`, "INFO");
        writeLog(`# ================================================`, "INFO");
        writeLog(`Projekt: ${config.projectName}`, "INFO");
        writeLog(`Pfad: ${finalProjectPath}`, "INFO");
        writeLog(`Tenant Slug: ${config.schemaName}`, "INFO");
        writeLog(`Tenant ID: ${ctx.tenantId || "nicht erstellt"}`, "INFO");
        writeLog(`INFRA-DB: ${config.infraDb.url}`, "INFO");
        writeLog(`DEV-DB: ${config.devDb.url}`, "INFO");
        writeLog(`GitHub: ${ctx.repoUrl || "nicht erstellt"}`, "INFO");
        writeLog(`Migration pending: ${ctx.migrationPending ? "JA" : "NEIN"}`, "INFO");
        const logFilePath = closeLog();
        ctx.logFilePath = logFilePath;
        task.title = `Log gespeichert \u2713`;
      }
    }
  ];
  return {
    tasks: taskDefinitions,
    listr: new Listr(taskDefinitions, {
      concurrent: false,
      renderer: "verbose",
      rendererOptions: {
        collapseSubtasks: false,
        showTimer: false,
        clearOutput: false,
        formatOutput: "default"
      }
    }),
    closeLog
    // Exportiere für manuellen Aufruf falls nötig
  };
}
var logFile, logPath, logClosed;
var init_phase3_create = __esm({
  "src/tasks/phase3-create.js"() {
    init_supabase();
    logFile = null;
    logPath = null;
    logClosed = false;
  }
});
function App({ projectNameArg, verbose, onComplete, onError }) {
  const [phase, setPhase] = useState("wizard");
  const [config, setConfig] = useState(null);
  const [ctx, setCtx] = useState({});
  const [tasks, setTasks] = useState([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const currentCwd = process.cwd();
  const projectName = projectNameArg || path6.basename(currentCwd);
  const projectPath = path6.resolve(currentCwd, projectName);
  const handleWizardComplete = (wizardConfig) => {
    setConfig(wizardConfig);
    setPhase("prechecks");
  };
  useEffect(() => {
    if (phase === "prechecks" && config) {
      const precheckTasks = createPrecheckTasks(config, { verbose });
      setTasks(precheckTasks.tasks || []);
      setCurrentTaskIndex(0);
    }
  }, [phase, config, verbose]);
  useEffect(() => {
    if (phase === "setup" && config) {
      const setupTasks = createSetupTasks(config, { verbose });
      setTasks(setupTasks.tasks || []);
      setCurrentTaskIndex(0);
    }
  }, [phase, config, verbose]);
  useEffect(() => {
    if (phase === "create" && config && projectPath) {
      const createTasks = createProjectTasks(config, ctx, projectPath, { verbose });
      setTasks(createTasks.tasks || []);
      setCurrentTaskIndex(0);
    }
  }, [phase, config, ctx, projectPath, verbose]);
  const handleTasksComplete = () => {
    if (phase === "prechecks") {
      setPhase("setup");
    } else if (phase === "setup") {
      setPhase("create");
    } else if (phase === "create") {
      setPhase("success");
      if (onComplete) {
        onComplete({ config, ctx, projectPath });
      }
    }
  };
  const handleError = (error) => {
    if (onError) {
      onError(error);
    }
  };
  return /* @__PURE__ */ React5.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React5.createElement(Banner, null), phase === "wizard" && /* @__PURE__ */ React5.createElement(
    Wizard,
    {
      projectNameArg,
      onComplete: handleWizardComplete,
      onError: handleError
    }
  ), phase === "prechecks" && /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement(PhaseHeader, { phase: 1, title: "PRE-CHECKS", progress: 20 }), /* @__PURE__ */ React5.createElement(
    TaskList,
    {
      tasks,
      ctx,
      setCtx,
      verbose,
      onComplete: handleTasksComplete,
      onError: handleError
    }
  )), phase === "setup" && /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement(PhaseHeader, { phase: 2, title: "SETUP", progress: 40 }), /* @__PURE__ */ React5.createElement(
    TaskList,
    {
      tasks,
      ctx,
      setCtx,
      verbose,
      onComplete: handleTasksComplete,
      onError: handleError
    }
  )), phase === "create" && /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement(PhaseHeader, { phase: 3, title: "PROJEKT-ERSTELLUNG", progress: 60 }), /* @__PURE__ */ React5.createElement(
    TaskList,
    {
      tasks,
      ctx,
      setCtx,
      verbose,
      onComplete: handleTasksComplete,
      onError: handleError
    }
  )), phase === "success" && config && /* @__PURE__ */ React5.createElement(Success, { config, ctx, projectPath }));
}
var init_App = __esm({
  "src/components/App.jsx"() {
    init_Banner();
    init_PhaseHeader();
    init_TaskList();
    init_Wizard();
    init_Success();
    init_phase1_prechecks();
    init_phase2_setup();
    init_phase3_create();
  }
});

// src/commands/init.jsx
var init_exports = {};
__export(init_exports, {
  runInitCommand: () => runInitCommand
});
async function runInitCommand(projectNameArg, options) {
  const verbose = options.verbose || false;
  const currentCwd = process.cwd();
  const projectName = projectNameArg || path6.basename(currentCwd);
  path6.resolve(currentCwd, projectName);
  if (!process.stdin.isTTY) {
    console.error(chalk11.red.bold("\n\u274C Fehler: Diese CLI ben\xF6tigt ein interaktives Terminal."));
    console.error(chalk11.yellow("   Bitte f\xFChre die CLI in einem Terminal aus (nicht in einem Pipe oder Script).\n"));
    process.exit(1);
  }
  return new Promise((resolve, reject) => {
    try {
      const { unmount } = render(
        /* @__PURE__ */ React5.createElement(
          App,
          {
            projectNameArg,
            verbose,
            onComplete: ({ config, ctx, projectPath: projectPath2 }) => {
              unmount();
              resolve({ config, ctx, projectPath: projectPath2 });
            },
            onError: (error) => {
              unmount();
              reject(error);
            }
          }
        ),
        {
          stdin: process.stdin,
          stdout: process.stdout,
          stderr: process.stderr
        }
      );
    } catch (error) {
      console.error(chalk11.red.bold("\n\u274C Fehler beim Starten der interaktiven UI:"));
      console.error(chalk11.red(error.message));
      console.error(chalk11.yellow("\nBitte stelle sicher, dass du die CLI in einem Terminal ausf\xFChrst.\n"));
      reject(error);
    }
  });
}
var init_init = __esm({
  "src/commands/init.jsx"() {
    init_App();
  }
});
function renderStatusTable(title, items) {
  console.log(chalk11.white.bold(`
  ${title}`));
  for (const item of items) {
    const icon = item.status === "ok" ? chalk11.green("\u2713") : item.status === "warning" ? chalk11.yellow("\u26A0") : item.status === "error" ? chalk11.red("\u2717") : chalk11.gray("\u25CB");
    const statusText = item.detail ? chalk11.gray(item.detail) : "";
    const padding = Math.max(0, 20 - item.name.length);
    console.log(`    ${icon} ${item.name.padEnd(padding + item.name.length)} ${statusText}`);
  }
}
var init_sections = __esm({
  "src/ui/sections.js"() {
  }
});

// src/commands/status.js
var status_exports = {};
__export(status_exports, {
  runStatusCommand: () => runStatusCommand
});
function isInstalled(command) {
  try {
    execSync(`${command} --version`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
function getVersion(command) {
  try {
    const output = execSync(`${command} --version`, { encoding: "utf-8", stdio: "pipe" });
    return output.trim().split("\n")[0];
  } catch {
    return null;
  }
}
function getGitHubUser() {
  try {
    const output = execSync("gh api user", { encoding: "utf-8", stdio: "pipe" });
    const user = JSON.parse(output);
    return user.login;
  } catch {
    return null;
  }
}
async function runStatusCommand() {
  const projectName = path6.basename(process.cwd());
  const config = loadConfig();
  console.log(chalk11.cyan.bold(`
  \u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E
  \u2502  KESSEL STATUS  (${projectName.padEnd(20)})     \u2502
  \u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F
  `));
  const infrastructureItems = [];
  if (isInstalled("gh")) {
    const user = getGitHubUser();
    infrastructureItems.push({
      name: "GitHub CLI",
      status: user ? "ok" : "warning",
      detail: user ? `logged in as ${user}` : "not authenticated"
    });
  } else {
    infrastructureItems.push({
      name: "GitHub CLI",
      status: "error",
      detail: "not installed"
    });
  }
  if (isInstalled("supabase")) {
    const version = getVersion("supabase");
    infrastructureItems.push({
      name: "Supabase CLI",
      status: "ok",
      detail: version || "installed"
    });
  } else {
    infrastructureItems.push({
      name: "Supabase CLI",
      status: "error",
      detail: "not installed"
    });
  }
  if (isInstalled("vercel")) {
    infrastructureItems.push({
      name: "Vercel CLI",
      status: "ok",
      detail: getVersion("vercel") || "installed"
    });
  } else {
    infrastructureItems.push({
      name: "Vercel CLI",
      status: "warning",
      detail: "not installed (optional)"
    });
  }
  if (isInstalled("pnpm")) {
    infrastructureItems.push({
      name: "pnpm",
      status: "ok",
      detail: getVersion("pnpm") || "installed"
    });
  } else {
    infrastructureItems.push({
      name: "pnpm",
      status: "warning",
      detail: "not installed"
    });
  }
  renderStatusTable("INFRASTRUCTURE", infrastructureItems);
  const dbItems = [];
  try {
    const infraResponse = await fetch(`${config.infraDb.url}/rest/v1/`, {
      method: "GET",
      headers: { apikey: "test" }
    });
    dbItems.push({
      name: "INFRA-DB",
      status: infraResponse.status === 401 || infraResponse.status === 200 ? "ok" : "warning",
      detail: config.infraDb.projectRef
    });
  } catch {
    dbItems.push({
      name: "INFRA-DB",
      status: "error",
      detail: "not reachable"
    });
  }
  try {
    const devResponse = await fetch(`${config.devDb.url}/rest/v1/`, {
      method: "GET",
      headers: { apikey: "test" }
    });
    dbItems.push({
      name: "DEV-DB",
      status: devResponse.status === 401 || devResponse.status === 200 ? "ok" : "warning",
      detail: config.devDb.projectRef
    });
  } catch {
    dbItems.push({
      name: "DEV-DB",
      status: "error",
      detail: "not reachable"
    });
  }
  renderStatusTable("DATABASE", dbItems);
  const secretsItems = [];
  const envPath = path6.join(process.cwd(), ".env");
  const envLocalPath = path6.join(process.cwd(), ".env.local");
  if (fs6.existsSync(envPath)) {
    const envContent = fs6.readFileSync(envPath, "utf-8");
    if (envContent.includes("SERVICE_ROLE_KEY")) {
      secretsItems.push({
        name: "SERVICE_ROLE_KEY",
        status: "ok",
        detail: "in .env"
      });
    } else {
      secretsItems.push({
        name: "SERVICE_ROLE_KEY",
        status: "warning",
        detail: "missing in .env"
      });
    }
  } else {
    secretsItems.push({
      name: "SERVICE_ROLE_KEY",
      status: "error",
      detail: ".env not found"
    });
  }
  if (fs6.existsSync(envLocalPath)) {
    const envLocalContent = fs6.readFileSync(envLocalPath, "utf-8");
    if (envLocalContent.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) {
      secretsItems.push({
        name: "ANON_KEY",
        status: "ok",
        detail: "in .env.local"
      });
    } else {
      secretsItems.push({
        name: "ANON_KEY",
        status: "warning",
        detail: "missing in .env.local"
      });
    }
  } else {
    secretsItems.push({
      name: "ANON_KEY",
      status: "error",
      detail: ".env.local not found"
    });
  }
  renderStatusTable("SECRETS", secretsItems);
  const mcpItems = [];
  const mcpConfigPath = path6.join(process.cwd(), ".cursor", "mcp.json");
  if (fs6.existsSync(mcpConfigPath)) {
    try {
      const mcpConfig = JSON.parse(fs6.readFileSync(mcpConfigPath, "utf-8"));
      const supabaseMCPs = Object.keys(mcpConfig.mcpServers || {}).filter((key) => key.toLowerCase().includes("supabase"));
      if (supabaseMCPs.length > 0) {
        mcpItems.push({
          name: "MCP config",
          status: "ok",
          detail: `${supabaseMCPs.length} Supabase MCP(s)`
        });
      } else {
        mcpItems.push({
          name: "MCP config",
          status: "warning",
          detail: "no Supabase MCP configured"
        });
      }
    } catch {
      mcpItems.push({
        name: "MCP config",
        status: "error",
        detail: "invalid JSON"
      });
    }
  } else {
    mcpItems.push({
      name: "MCP config",
      status: "warning",
      detail: ".cursor/mcp.json not found"
    });
  }
  renderStatusTable("MCP / INTEGRATIONS", mcpItems);
  console.log("\n");
}
var init_status = __esm({
  "src/commands/status.js"() {
    init_sections();
    init_config();
  }
});

// src/commands/secrets.js
var secrets_exports = {};
__export(secrets_exports, {
  registerSecretsCommands: () => registerSecretsCommands
});
function registerSecretsCommands(secretsCommand2) {
  secretsCommand2.command("get").description("Ruft Secrets aus der INFRA-DB (Kessel Vault) ab").argument("[secret-name]", "Name des Secrets (optional, zeigt alle wenn nicht angegeben)").option("--json", "Ausgabe im JSON-Format").option("--env", "Ausgabe im .env-Format").option("-v, --verbose", "Detaillierte Debug-Ausgaben").action(async (secretName, options) => {
    const verbose = options.verbose === true || process.argv.includes("--verbose") || process.argv.includes("-v");
    try {
      debugLog("=== Secrets Get Command gestartet ===", { verbose }, verbose);
      const config = loadConfig();
      const serviceRoleKey = loadServiceRoleKey();
      if (!serviceRoleKey) {
        console.error(chalk11.red("\u274C SERVICE_ROLE_KEY nicht gefunden. Bitte konfiguriere die .env Datei."));
        process.exit(1);
      }
      debugLog("SERVICE_ROLE_KEY geladen", { keyMasked: maskSecret(serviceRoleKey) }, verbose);
      const supabase = createClient(config.defaultSupabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      debugLog("Supabase Client erstellt", null, verbose);
      let secrets = {};
      try {
        debugLog("Rufe get_all_secrets_for_env() RPC-Funktion auf...", null, verbose);
        const { data, error } = await supabase.rpc("get_all_secrets_for_env", {});
        debugLog("RPC Response erhalten", {
          hasData: !!data,
          hasError: !!error
        }, verbose);
        if (error) {
          debugError(error, verbose);
          throw error;
        }
        secrets = data || {};
        debugLog(`RPC erfolgreich: ${Object.keys(secrets).length} Secrets abgerufen`, null, verbose);
      } catch (error) {
        debugError(error, verbose);
        if (error.message?.includes("schema cache")) {
          console.warn(chalk11.yellow("\u26A0 Schema-Cache noch nicht aktualisiert. Verwende Fallback..."));
          try {
            const httpResult = await callRpcViaHttp(
              config.defaultSupabaseUrl,
              serviceRoleKey,
              "get_all_secrets_for_env",
              {},
              verbose
            );
            if (httpResult.error) {
              throw httpResult.error;
            }
            secrets = httpResult.data || {};
          } catch (httpError) {
            debugError(httpError, verbose);
            if (secretName) {
              try {
                const { data, error: readError } = await supabase.rpc("read_secret", {
                  secret_name: secretName
                });
                if (readError) {
                  const httpReadResult = await callRpcViaHttp(
                    config.defaultSupabaseUrl,
                    serviceRoleKey,
                    "read_secret",
                    { secret_name: secretName },
                    verbose
                  );
                  if (httpReadResult.error) {
                    throw httpReadResult.error;
                  }
                  const secretValue = httpReadResult.data;
                  outputSecret(secretName, secretValue, options);
                  return;
                }
                outputSecret(secretName, data, options);
                return;
              } catch (readError) {
                debugError(readError, verbose);
                throw readError;
              }
            } else {
              console.warn(chalk11.yellow("\u26A0 Versuche direkten SQL-Fallback..."));
              const sqlResult = await getSecretsViaDirectSql(
                config.defaultSupabaseUrl,
                serviceRoleKey,
                null,
                verbose
              );
              if (sqlResult.error) {
                throw sqlResult.error;
              }
              secrets = sqlResult.data || {};
              if (typeof secrets === "string") {
                secrets = JSON.parse(secrets);
              }
            }
          }
        } else {
          throw error;
        }
      }
      if (secretName) {
        const value = secrets[secretName];
        if (!value) {
          console.error(chalk11.red(`\u274C Secret "${secretName}" nicht gefunden`));
          process.exit(1);
        }
        outputSecret(secretName, value, options);
        return;
      }
      const entries = Object.entries(secrets).sort(([a], [b]) => a.localeCompare(b));
      if (options.json) {
        console.log(JSON.stringify(secrets, null, 2));
      } else if (options.env) {
        entries.forEach(([key, value]) => console.log(`${key}=${value}`));
      } else {
        console.log(chalk11.cyan.bold(`
\u{1F4CB} Secrets (${entries.length}):
`));
        entries.forEach(([key, value]) => {
          const preview = value.length > 50 ? value.substring(0, 50) + "..." : value;
          console.log(chalk11.white(`  ${key.padEnd(40)} ${chalk11.dim(preview)}`));
        });
        console.log();
      }
    } catch (error) {
      console.error(chalk11.red.bold("\n\u274C Fehler beim Abrufen der Secrets:"));
      console.error(chalk11.red(error.message));
      debugError(error, verbose);
      console.error(chalk11.dim("\n\u{1F4A1} Tipp: Verwende --verbose f\xFCr detaillierte Debug-Informationen"));
      process.exit(1);
    }
  });
  secretsCommand2.command("add").description("F\xFCgt ein neues Secret zum Vault hinzu").argument("<secret-name>", "Name des Secrets").argument("<secret-value>", "Wert des Secrets").option("--force", "\xDCberschreibt existierendes Secret").option("-v, --verbose", "Detaillierte Debug-Ausgaben").action(async (secretName, secretValue, options) => {
    const verbose = !!options.verbose;
    try {
      debugLog("=== Secrets Add Command gestartet ===", { secretName }, verbose);
      const config = loadConfig();
      const serviceRoleKey = loadServiceRoleKey();
      if (!serviceRoleKey) {
        console.error(chalk11.red("\u274C SERVICE_ROLE_KEY nicht gefunden."));
        process.exit(1);
      }
      const supabase = createClient(config.defaultSupabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      if (!options.force) {
        try {
          const { data: data2, error: error2 } = await supabase.rpc("read_secret", {
            secret_name: secretName
          });
          if (!error2 && data2) {
            console.error(chalk11.red(`\u274C Secret "${secretName}" existiert bereits`));
            console.error(chalk11.yellow(`   Verwende --force um zu \xFCberschreiben
`));
            process.exit(1);
          }
        } catch (error2) {
        }
      }
      console.log(chalk11.blue(`\u{1F4DD} F\xFCge Secret "${secretName}" hinzu...`));
      const { data, error } = await supabase.rpc("insert_secret", {
        name: secretName,
        secret: secretValue
      });
      if (error) {
        debugError(error, verbose);
        if (error.message?.includes("schema cache")) {
          try {
            const httpResult = await callRpcViaHttp(
              config.defaultSupabaseUrl,
              serviceRoleKey,
              "insert_secret",
              { name: secretName, secret: secretValue },
              verbose
            );
            if (httpResult.error) {
              throw httpResult.error;
            }
            console.log(chalk11.green(`\u2713 Secret "${secretName}" erfolgreich hinzugef\xFCgt`));
            console.log(chalk11.dim(`  UUID: ${httpResult.data}
`));
            return;
          } catch (httpError) {
            debugError(httpError, verbose);
            throw new Error("Schema-Cache noch nicht aktualisiert.");
          }
        }
        throw error;
      }
      console.log(chalk11.green(`\u2713 Secret "${secretName}" erfolgreich hinzugef\xFCgt`));
      console.log(chalk11.dim(`  UUID: ${data}
`));
    } catch (error) {
      console.error(chalk11.red.bold("\n\u274C Fehler beim Hinzuf\xFCgen des Secrets:"));
      console.error(chalk11.red(error.message));
      debugError(error, verbose);
      process.exit(1);
    }
  });
  secretsCommand2.command("update").description("Aktualisiert ein existierendes Secret").argument("<secret-name>", "Name des Secrets").argument("<secret-value>", "Neuer Wert des Secrets").option("-v, --verbose", "Detaillierte Debug-Ausgaben").action(async (secretName, secretValue, options) => {
    const verbose = !!options.verbose;
    try {
      const config = loadConfig();
      const serviceRoleKey = loadServiceRoleKey();
      if (!serviceRoleKey) {
        console.error(chalk11.red("\u274C SERVICE_ROLE_KEY nicht gefunden."));
        process.exit(1);
      }
      const supabase = createClient(config.defaultSupabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      console.log(chalk11.blue(`\u{1F50D} Pr\xFCfe ob Secret "${secretName}" existiert...`));
      let existingValue = null;
      try {
        const { data: data2, error } = await supabase.rpc("read_secret", {
          secret_name: secretName
        });
        if (error) {
          if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
            console.error(chalk11.red(`\u274C Secret "${secretName}" existiert nicht`));
            console.error(chalk11.yellow(`   Verwende "secrets add" um ein neues Secret hinzuzuf\xFCgen
`));
            process.exit(1);
          }
          const httpResult = await callRpcViaHttp(
            config.defaultSupabaseUrl,
            serviceRoleKey,
            "read_secret",
            { secret_name: secretName },
            verbose
          );
          if (httpResult.error) {
            throw httpResult.error;
          }
          existingValue = httpResult.data;
        } else {
          existingValue = data2;
        }
      } catch (error) {
        if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
          console.error(chalk11.red(`\u274C Secret "${secretName}" existiert nicht`));
          process.exit(1);
        }
        throw error;
      }
      if (existingValue === secretValue) {
        console.log(chalk11.yellow(`\u26A0 Secret "${secretName}" hat bereits diesen Wert`));
        process.exit(0);
      }
      console.log(chalk11.blue(`\u{1F504} Aktualisiere Secret "${secretName}"...`));
      const { error: deleteError } = await supabase.rpc("delete_secret", {
        secret_name: secretName
      });
      if (deleteError) {
        if (deleteError.message?.includes("schema cache")) {
          await callRpcViaHttp(
            config.defaultSupabaseUrl,
            serviceRoleKey,
            "delete_secret",
            { secret_name: secretName },
            verbose
          );
        } else {
          throw deleteError;
        }
      }
      const { data, error: insertError } = await supabase.rpc("insert_secret", {
        name: secretName,
        secret: secretValue
      });
      if (insertError) {
        if (insertError.message?.includes("schema cache")) {
          const httpResult = await callRpcViaHttp(
            config.defaultSupabaseUrl,
            serviceRoleKey,
            "insert_secret",
            { name: secretName, secret: secretValue },
            verbose
          );
          if (httpResult.error) {
            throw httpResult.error;
          }
          console.log(chalk11.green(`\u2713 Secret "${secretName}" erfolgreich aktualisiert`));
          console.log(chalk11.dim(`  UUID: ${httpResult.data}
`));
          return;
        }
        throw insertError;
      }
      console.log(chalk11.green(`\u2713 Secret "${secretName}" erfolgreich aktualisiert`));
      console.log(chalk11.dim(`  UUID: ${data}
`));
    } catch (error) {
      console.error(chalk11.red.bold("\n\u274C Fehler beim Aktualisieren des Secrets:"));
      console.error(chalk11.red(error.message));
      debugError(error, verbose);
      process.exit(1);
    }
  });
  secretsCommand2.command("delete").description("L\xF6scht ein Secret aus dem Vault").argument("<secret-name>", "Name des Secrets").option("--force", "L\xF6scht ohne Best\xE4tigung").option("-v, --verbose", "Detaillierte Debug-Ausgaben").action(async (secretName, options) => {
    const verbose = !!options.verbose;
    try {
      const config = loadConfig();
      const serviceRoleKey = loadServiceRoleKey();
      if (!serviceRoleKey) {
        console.error(chalk11.red("\u274C SERVICE_ROLE_KEY nicht gefunden."));
        process.exit(1);
      }
      const supabase = createClient(config.defaultSupabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: `M\xF6chtest du das Secret "${secretName}" wirklich l\xF6schen?`,
            default: false
          }
        ]);
        if (!confirm) {
          console.log(chalk11.yellow("Abgebrochen."));
          process.exit(0);
        }
      }
      console.log(chalk11.blue(`\u{1F5D1}\uFE0F  L\xF6sche Secret "${secretName}"...`));
      const { error } = await supabase.rpc("delete_secret", {
        secret_name: secretName
      });
      if (error) {
        debugError(error, verbose);
        if (error.message?.includes("schema cache")) {
          await callRpcViaHttp(
            config.defaultSupabaseUrl,
            serviceRoleKey,
            "delete_secret",
            { secret_name: secretName },
            verbose
          );
          console.log(chalk11.green(`\u2713 Secret "${secretName}" erfolgreich gel\xF6scht
`));
          return;
        }
        if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
          console.error(chalk11.red(`\u274C Secret "${secretName}" existiert nicht`));
          process.exit(1);
        }
        throw error;
      }
      console.log(chalk11.green(`\u2713 Secret "${secretName}" erfolgreich gel\xF6scht
`));
    } catch (error) {
      console.error(chalk11.red.bold("\n\u274C Fehler beim L\xF6schen des Secrets:"));
      console.error(chalk11.red(error.message));
      debugError(error, verbose);
      process.exit(1);
    }
  });
}
function outputSecret(name, value, options) {
  if (options.json) {
    console.log(JSON.stringify({ [name]: value }, null, 2));
  } else if (options.env) {
    console.log(`${name}=${value}`);
  } else {
    console.log(chalk11.green(`\u2713 ${name}: ${value}`));
  }
}
var init_secrets = __esm({
  "src/commands/secrets.js"() {
    init_config();
    init_debug();
    init_supabase();
  }
});
var __filename2 = fileURLToPath(import.meta.url);
var __dirname2 = path6.dirname(__filename2);
function getBoilerplateVersion() {
  try {
    const boilerplatePath = path6.resolve(__dirname2, "..", "kessel-boilerplate", "boilerplate.json");
    if (fs6.existsSync(boilerplatePath)) {
      const data = JSON.parse(fs6.readFileSync(boilerplatePath, "utf-8"));
      return data.version || "unknown";
    }
  } catch (e) {
  }
  return "unknown";
}
var CLI_VERSION = "2.1.0";
var BOILERPLATE_VERSION = getBoilerplateVersion();
program.name("kessel").description("CLI f\xFCr die Kessel Boilerplate - Erstellt neue Next.js-Projekte mit Supabase & ShadCN UI").version(CLI_VERSION).configureOutput({
  writeOut: (str) => process.stdout.write(str),
  writeErr: (str) => process.stderr.write(str)
});
program.command("version").description("Zeigt CLI und Boilerplate Version").action(() => {
  console.log(`Kessel CLI: v${CLI_VERSION}`);
  console.log(`Boilerplate: v${BOILERPLATE_VERSION}`);
});
program.argument("[project-name]", "Name des Projekts (optional)").option("-v, --verbose", "Detaillierte Debug-Ausgaben", false).action(async (projectNameArg, options) => {
  const { runInitCommand: runInitCommand2 } = await Promise.resolve().then(() => (init_init(), init_exports));
  await runInitCommand2(projectNameArg, options);
});
program.command("status").description("Zeigt Status-Dashboard f\xFCr CLI, DB, Secrets und MCP").action(async () => {
  const { runStatusCommand: runStatusCommand2 } = await Promise.resolve().then(() => (init_status(), status_exports));
  await runStatusCommand2();
});
var secretsCommand = program.command("secrets").description("Verwaltet Secrets in der INFRA-DB (Kessel Vault)");
var { registerSecretsCommands: registerSecretsCommands2 } = await Promise.resolve().then(() => (init_secrets(), secrets_exports));
registerSecretsCommands2(secretsCommand);
program.parse(process.argv);
