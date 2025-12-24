#!/usr/bin/env node
import React4, { useEffect, useState } from 'react';
import { render, Box, Text, useStdin, useApp } from 'ink';
import Gradient2 from 'ink-gradient';
import figlet from 'figlet';
import Spinner2 from 'ink-spinner';
import fs6 from 'fs';
import path6 from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import chalk12 from 'chalk';
import { execSync, spawn, exec } from 'child_process';
import pg from 'pg';
import enquirer from 'enquirer';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import BigText from 'ink-big-text';
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
  const asciiArt = figlet.textSync("KESSEL", {
    font: "ANSI Shadow",
    horizontalLayout: "default",
    verticalLayout: "default"
  });
  return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React4.createElement(Gradient2, { colors: ["#4A90E2", "#50C878", "#2E8B57"] }, /* @__PURE__ */ React4.createElement(Text, null, asciiArt)), /* @__PURE__ */ React4.createElement(Box, { marginTop: 0, flexDirection: "column" }, /* @__PURE__ */ React4.createElement(Gradient2, { colors: ["#4A90E2", "#50C878"] }, /* @__PURE__ */ React4.createElement(Text, { bold: true }, "CLI v", CLI_VERSION)), /* @__PURE__ */ React4.createElement(Text, { color: "gray", dimColor: true }, "B2B App Boilerplate Generator")));
}
var CLI_VERSION;
var init_Banner = __esm({
  "src/components/Banner.jsx"() {
    CLI_VERSION = "2.1.0";
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
          const finalTitle = mockTask.title || taskDef.title;
          debug(`\u2713 Fertig: ${finalTitle} (${duration}ms)`);
          setCtx((prevCtx) => ({ ...prevCtx, ...taskCtx }));
          setTaskStates((prev) => ({
            ...prev,
            [i]: { status: "completed", title: finalTitle }
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
  return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, tasks.map((taskDef, index) => {
    const state = taskStates[index];
    if (!state) {
      return null;
    }
    if (state.status === "skipped") {
      return /* @__PURE__ */ React4.createElement(Text, { key: index, dimColor: true }, `  \u23ED  ${taskDef.title} (${state.message})`);
    }
    if (state.status === "running") {
      return /* @__PURE__ */ React4.createElement(Box, { key: index, flexDirection: "row" }, /* @__PURE__ */ React4.createElement(Text, { color: "cyan" }, `  \u23F3 ${taskDef.title}...`), /* @__PURE__ */ React4.createElement(Spinner2, { type: "dots" }));
    }
    if (state.status === "completed") {
      const displayTitle = state.title || taskDef.title;
      return /* @__PURE__ */ React4.createElement(Text, { key: index, color: "green" }, `  \u2713 ${displayTitle}`);
    }
    if (state.status === "error") {
      return /* @__PURE__ */ React4.createElement(Box, { key: index, flexDirection: "column" }, /* @__PURE__ */ React4.createElement(Text, { color: "red" }, `  \u2717 ${taskDef.title}`), /* @__PURE__ */ React4.createElement(Text, { color: "red" }, `    Fehler: ${state.error}`));
    }
    return null;
  }), verbose && debugLogs.length > 0 && /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column", marginTop: 1, borderStyle: "single", borderColor: "gray", paddingX: 1 }, /* @__PURE__ */ React4.createElement(Text, { color: "gray", bold: true }, "\u{1F50D} Debug-Log:"), debugLogs.map((log, i) => /* @__PURE__ */ React4.createElement(Text, { key: i, color: "gray", dimColor: true }, log))));
}
var init_TaskList = __esm({
  "src/components/TaskList.jsx"() {
  }
});
function WizardProgress({ currentStep, totalSteps, stepTitle }) {
  const step = currentStep + 1;
  const indicators = [];
  for (let i = 0; i < totalSteps; i++) {
    if (i < currentStep) {
      indicators.push(
        /* @__PURE__ */ React4.createElement(Text, { key: i, color: "green" }, "\u25CF")
      );
    } else if (i === currentStep) {
      indicators.push(
        /* @__PURE__ */ React4.createElement(Text, { key: i, color: "cyan", bold: true }, "\u25CF")
      );
    } else {
      indicators.push(
        /* @__PURE__ */ React4.createElement(Text, { key: i, color: "gray", dimColor: true }, "\u25CB")
      );
    }
  }
  return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React4.createElement(Box, { flexDirection: "row", alignItems: "center", gap: 1 }, /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "Schritt ", step, "/", totalSteps, ":"), /* @__PURE__ */ React4.createElement(Box, { flexDirection: "row", gap: 0 }, indicators)), stepTitle && /* @__PURE__ */ React4.createElement(Text, { color: "white", dimColor: true, marginTop: 0 }, stepTitle));
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
  loadServiceRoleKey: () => loadServiceRoleKey,
  loadSupabasePat: () => loadSupabasePat
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
      console.warn(chalk12.yellow("\u26A0\uFE0F  Konfigurationsdatei konnte nicht geladen werden, verwende Standardwerte"));
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
      console.error(chalk12.red(`\u274C Fehler beim Lesen der .env Datei: ${error.message}`));
      return null;
    }
  } else {
    console.error(chalk12.red(`\u274C .env Datei nicht gefunden: ${BOILERPLATE_ENV_PATH}`));
    return null;
  }
  return null;
}
function loadSupabasePat() {
  if (process.env.SUPABASE_PAT) {
    return process.env.SUPABASE_PAT.trim();
  }
  if (fs6.existsSync(BOILERPLATE_ENV_PATH)) {
    try {
      const envContent = fs6.readFileSync(BOILERPLATE_ENV_PATH, "utf-8");
      const match = envContent.match(/SUPABASE_PAT=(.+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
    }
  }
  const profileDir = path6.join(os.homedir(), ".kessel");
  if (fs6.existsSync(profileDir)) {
    try {
      const files = fs6.readdirSync(profileDir).filter((f) => f.endsWith(".kesselprofile"));
      for (const file of files) {
        const content = fs6.readFileSync(path6.join(profileDir, file), "utf-8");
        const match = content.match(/SUPABASE_PAT=(.+)/);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    } catch {
    }
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
  console.log(chalk12.dim(`[DEBUG] ${message}`));
  if (data) {
    if (typeof data === "object") {
      console.log(chalk12.dim(JSON.stringify(data, null, 2)));
    } else {
      console.log(chalk12.dim(String(data)));
    }
  }
}
function debugError(error, verbose = false) {
  if (!verbose) return;
  console.error(chalk12.red.dim(`[DEBUG ERROR] ${error.message}`));
  if (error.stack) {
    console.error(chalk12.red.dim(error.stack));
  }
  if (error.code) {
    console.error(chalk12.red.dim(`[DEBUG ERROR CODE] ${error.code}`));
  }
  if (error.details) {
    console.error(chalk12.red.dim(`[DEBUG ERROR DETAILS] ${error.details}`));
  }
  if (error.hint) {
    console.error(chalk12.red.dim(`[DEBUG ERROR HINT] ${error.hint}`));
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
  callRpcViaHttp: () => callRpcViaHttp,
  createSupabaseProject: () => createSupabaseProject,
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
    console.log(chalk12.blue("\u{1F50D} Versuche SERVICE_ROLE_KEY aus Vault zu holen..."));
    serviceRoleKey = await fetchServiceRoleKeyFromVault(infraUrl, tempServiceRoleKey, (msg) => {
    });
    if (serviceRoleKey) {
      console.log(chalk12.green("\u2713 SERVICE_ROLE_KEY aus Vault geholt"));
    } else {
      console.log(chalk12.yellow("\u26A0\uFE0F  Vault-Zugriff fehlgeschlagen, versuche Management API..."));
    }
  }
  if (!serviceRoleKey && infraProjectRef) {
    serviceRoleKey = await fetchServiceRoleKeyFromSupabase(infraProjectRef, (msg) => {
    });
    if (serviceRoleKey) {
      console.log(chalk12.green("\u2713 SERVICE_ROLE_KEY \xFCber Management API geholt"));
    }
  }
  if (!serviceRoleKey) {
    serviceRoleKey = tempServiceRoleKey;
    if (serviceRoleKey) {
      console.log(chalk12.dim("\u2139\uFE0F  Verwende SERVICE_ROLE_KEY aus Profil"));
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
  const [startDevServer2, setStartDevServer] = useState(null);
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
      const finalStartDevServer = overrides.startDevServer !== void 0 ? overrides.startDevServer : startDevServer2;
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
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(Text, { color: "red", bold: true }, "\u274C Fehler: Raw mode wird nicht unterst\xFCtzt"), /* @__PURE__ */ React4.createElement(Text, { color: "yellow" }, "   Diese CLI ben\xF6tigt ein interaktives Terminal."), /* @__PURE__ */ React4.createElement(Text, { color: "yellow" }, "   Bitte f\xFChre die CLI in einem Terminal aus (nicht in einem Pipe oder Script)."));
  }
  if (loading) {
    return /* @__PURE__ */ React4.createElement(Box, null, /* @__PURE__ */ React4.createElement(Spinner2, { type: "dots" }), /* @__PURE__ */ React4.createElement(Text, null, " ", loadingMessage));
  }
  if (step === 0) {
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "Dein Username:"), /* @__PURE__ */ React4.createElement(
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
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "INFRA-DB URL (Kessel - Auth, Vault, Multi-Tenant):"), /* @__PURE__ */ React4.createElement(
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
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "DEV-DB URL (App-Daten, Entwicklung):"), /* @__PURE__ */ React4.createElement(
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
    ), fetchingServiceRoleKey && /* @__PURE__ */ React4.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React4.createElement(Spinner2, { type: "dots" }), /* @__PURE__ */ React4.createElement(Text, null, " ", serviceRoleKeyStatus)), serviceRoleKeyStatus && !fetchingServiceRoleKey && /* @__PURE__ */ React4.createElement(Text, { color: serviceRoleKeyStatus.startsWith("\u2713") ? "green" : "yellow", marginTop: 1 }, serviceRoleKeyStatus));
  }
  if (step === 3) {
    const cleanedInfraUrlForValidation = cleanUrl(infraUrl);
    const infraProjectRefForValidation = cleanedInfraUrlForValidation ? new URL(cleanedInfraUrlForValidation).hostname.split(".")[0] : null;
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "SERVICE_ROLE_KEY (f\xFCr INFRA-DB: ", infraProjectRefForValidation, "):"), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, "Der Key muss zur INFRA-DB passen, nicht zur DEV-DB!"), /* @__PURE__ */ React4.createElement(
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
    ), serviceRoleKeyStatus && /* @__PURE__ */ React4.createElement(Text, { color: "yellow" }, serviceRoleKeyStatus));
  }
  if (step === 4) {
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "Projektname:"), /* @__PURE__ */ React4.createElement(
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
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "Installationsordner:"), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, "Aktuelles Verzeichnis: ", defaultPath), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, "Leer lassen f\xFCr: ", defaultPath), /* @__PURE__ */ React4.createElement(
      TextInput,
      {
        value: installPath,
        onChange: setInstallPath,
        onSubmit: (value) => {
          setInstallPathSubmitted(true);
          setStep(6);
        }
      }
    ), /* @__PURE__ */ React4.createElement(Text, { color: "gray", marginTop: 1 }, "Vollst\xE4ndiger Pfad: ", fullPath));
  }
  if (step === 6) {
    if (fetchingDbPassword) {
      return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "DB-Passwort (optional):"), /* @__PURE__ */ React4.createElement(Box, null, /* @__PURE__ */ React4.createElement(Text, { color: "yellow" }, /* @__PURE__ */ React4.createElement(Spinner2, { type: "dots" })), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, " Suche Passwort im Vault...")));
    }
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "DB-Passwort (optional):"), dbPasswordFromVault ? /* @__PURE__ */ React4.createElement(Text, { color: "green" }, "\u2713 Aus Vault geladen (SUPABASE_DB_PASSWORD)") : /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, "F\xFCr automatische Schema-Konfiguration (PostgREST)"), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, "Leer lassen = sp\xE4ter manuell via Migration")), /* @__PURE__ */ React4.createElement(
      TextInput,
      {
        value: dbPassword,
        onChange: (value) => {
          setDbPassword(value);
          if (dbPasswordFromVault && value !== dbPassword) {
            setDbPasswordFromVault(false);
          }
        },
        onSubmit: (value) => {
          if (value.trim()) {
            setDbPassword(value.trim());
          }
          setDbPasswordSubmitted(true);
          setStep(7);
        }
      }
    ), /* @__PURE__ */ React4.createElement(Text, { color: "gray", marginTop: 1 }, dbPassword ? dbPasswordFromVault ? "\u21B5 Enter zum Best\xE4tigen" : "\u2713 Passwort eingegeben" : "Leer lassen = Migration-Datei wird erstellt"));
  }
  if (step === 7) {
    const githubOptions = [
      { label: "Ja, privat", value: "private" },
      { label: "Ja, \xF6ffentlich", value: "public" },
      { label: "Nein, nur lokal", value: "none" }
    ];
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "GitHub Repository erstellen?"), /* @__PURE__ */ React4.createElement(
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
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "Dependencies automatisch installieren?"), /* @__PURE__ */ React4.createElement(
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
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "Mit Vercel verkn\xFCpfen?"), /* @__PURE__ */ React4.createElement(
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
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "Initial Commit erstellen?"), /* @__PURE__ */ React4.createElement(
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
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "\xC4nderungen zu GitHub pushen?"), /* @__PURE__ */ React4.createElement(
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
    return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(WizardProgress, { currentStep: step, totalSteps: TOTAL_STEPS, stepTitle: STEP_TITLES[step] }), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "Dev-Server nach Erstellung starten?"), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, "Startet `pnpm dev` im Projekt-Verzeichnis"), /* @__PURE__ */ React4.createElement(
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
function Success({ config, ctx, projectPath, dryRun }) {
  const { exit } = useApp();
  useEffect(() => {
    const timer = setTimeout(() => {
      exit();
    }, 2e3);
    return () => clearTimeout(timer);
  }, [exit]);
  return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React4.createElement(Gradient2, { colors: ["#4A90E2", "#50C878", "#2E8B57"] }, /* @__PURE__ */ React4.createElement(BigText, { text: dryRun ? "DRY-RUN" : "SUCCESS", font: "chrome" })), /* @__PURE__ */ React4.createElement(Gradient2, { colors: ["#4A90E2", "#50C878"] }, /* @__PURE__ */ React4.createElement(Text, { bold: true }, dryRun ? `\u2728 Dry-Run abgeschlossen - Projekt "${config.projectName}" w\xFCrde erstellt werden` : `\u2728 Projekt "${config.projectName}" erfolgreich erstellt!`))), dryRun && /* @__PURE__ */ React4.createElement(Text, { color: "yellow", bold: true, marginTop: 1 }, "\u26A0\uFE0F  Keine Dateien wurden erstellt oder ge\xE4ndert"), config.startDevServer ? /* @__PURE__ */ React4.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React4.createElement(Gradient2, { colors: ["#4A90E2", "#5FB3D3"] }, /* @__PURE__ */ React4.createElement(Text, { bold: true }, "\u{1F680} Dev-Server wird gestartet...")), /* @__PURE__ */ React4.createElement(Text, { color: "white", marginTop: 0 }, `  \u2192 http://localhost:3000`), /* @__PURE__ */ React4.createElement(Text, { color: "cyan", marginTop: 0 }, `  \u23F3 Bitte warten...`)) : /* @__PURE__ */ React4.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React4.createElement(Gradient2, { colors: ["#4A90E2", "#50C878"] }, /* @__PURE__ */ React4.createElement(Text, { bold: true }, "\u{1F4CB} N\xE4chste Schritte:")), /* @__PURE__ */ React4.createElement(Text, { color: "white", marginTop: 0 }, `  1. cd ${config.projectName}`), ctx.migrationPending && /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement(Text, { color: "yellow" }, `  2. export SUPABASE_DB_PASSWORD=dein-password`), /* @__PURE__ */ React4.createElement(Text, { color: "yellow" }, `  3. pnpm db:migrate`), /* @__PURE__ */ React4.createElement(Text, { color: "white" }, `  4. pnpm dev`)), !ctx.migrationPending && /* @__PURE__ */ React4.createElement(Text, { color: "white" }, `  2. pnpm dev`), /* @__PURE__ */ React4.createElement(Text, { color: "white" }, `  \u2192 http://localhost:3000`)), /* @__PURE__ */ React4.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React4.createElement(Text, { color: "gray", bold: true }, "\u{1F4DD} Projekt-Details:"), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, `  Schema: ${config.schemaName}`), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, `  INFRA-DB: ${config.infraDb?.projectRef || "N/A"}`), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, `  DEV-DB: ${config.devDb?.projectRef || "N/A"}`), ctx.repoUrl && /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, `  GitHub: ${ctx.repoUrl}`)), ctx.logFilePath && /* @__PURE__ */ React4.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React4.createElement(Text, { color: "gray", bold: true }, "\u{1F4C4} Log-Datei:"), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, `  ${ctx.logFilePath}`)), ctx.migrationPending && !dryRun && /* @__PURE__ */ React4.createElement(Box, { marginTop: 1, flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1 }, /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true }, "\u{1F4CB} WICHTIG: Datenbank-Migration ausf\xFChren!"), /* @__PURE__ */ React4.createElement(Text, { color: "white" }, `   export SUPABASE_DB_PASSWORD=dein-db-password`), /* @__PURE__ */ React4.createElement(Text, { color: "white" }, `   pnpm db:migrate`), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, `   \u2192 Konfiguriert Schema "${config.schemaName}" + PostgREST`), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, `   \u2192 Behebt PGRST106 Fehler automatisch`)), ctx.schemaManualSetup && !dryRun && /* @__PURE__ */ React4.createElement(Box, { marginTop: 1, flexDirection: "column", borderStyle: "round", borderColor: "yellow", paddingX: 1 }, /* @__PURE__ */ React4.createElement(Text, { color: "yellow", bold: true }, "\u26A0\uFE0F  Schema-Konfiguration pr\xFCfen"), /* @__PURE__ */ React4.createElement(Text, { color: "yellow" }, `   Falls PGRST106 Fehler auftreten:`), /* @__PURE__ */ React4.createElement(Text, { color: "white" }, `   1. Dashboard \u2192 Settings \u2192 API \u2192 Exposed schemas`), /* @__PURE__ */ React4.createElement(Text, { color: "white" }, `   2. Schema "${config.schemaName}" hinzuf\xFCgen`), /* @__PURE__ */ React4.createElement(Text, { color: "gray" }, `   (PostgREST-Config konnte nicht automatisch gesetzt werden)`)), !config.startDevServer && /* @__PURE__ */ React4.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React4.createElement(Gradient2, { colors: ["#4A90E2", "#50C878"] }, /* @__PURE__ */ React4.createElement(Text, { bold: true }, `\u{1F680} Happy Coding!`))));
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
      console.log(chalk12.yellow("\n\u26A0\uFE0F  GitHub CLI nicht gefunden"));
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
      console.log(chalk12.yellow("\n\u26A0\uFE0F  GitHub CLI nicht authentifiziert"));
      const { login } = await inquirer.prompt([
        {
          type: "confirm",
          name: "login",
          message: "M\xF6chtest du dich jetzt bei GitHub anmelden?",
          default: true
        }
      ]);
      if (login) {
        console.log(chalk12.blue("\xD6ffne GitHub Login..."));
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
    console.log(chalk12.yellow("\n\u26A0\uFE0F  Vercel CLI nicht gefunden"));
    const { install } = await inquirer.prompt([
      {
        type: "confirm",
        name: "install",
        message: "M\xF6chtest du Vercel CLI jetzt installieren? (npm install -g vercel)",
        default: false
      }
    ]);
    if (install) {
      console.log(chalk12.blue("Installiere Vercel CLI..."));
      try {
        execSync("npm install -g vercel", { stdio: "inherit" });
      } catch (error) {
        throw new Error(`Vercel CLI Installation fehlgeschlagen: ${error.message}`);
      }
    } else {
      console.log(chalk12.dim("Vercel CLI wird \xFCbersprungen (optional)"));
      return;
    }
  }
  updateProgress(progressBar, null, "Pr\xFCfe Vercel Authentifizierung...");
  if (!isVercelCLIAuthenticated()) {
    console.log(chalk12.yellow("\n\u26A0\uFE0F  Vercel CLI nicht authentifiziert"));
    const { login } = await inquirer.prompt([
      {
        type: "confirm",
        name: "login",
        message: "M\xF6chtest du dich jetzt bei Vercel anmelden?",
        default: false
      }
    ]);
    if (login) {
      console.log(chalk12.blue("\xD6ffne Vercel Login..."));
      try {
        execSync("vercel login", { stdio: "inherit" });
      } catch (error) {
        console.log(chalk12.yellow("\u26A0\uFE0F  Vercel Login fehlgeschlagen (optional)"));
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
      console.log(chalk12.green(`\u2713 pnpm gefunden (Version ${version})`));
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
      console.log(chalk12.yellow(`\u26A0\uFE0F  pnpm nicht gefunden, verwende npm (Version ${version})`));
      console.log(chalk12.dim("   Tipp: pnpm wird empfohlen. Installiere mit: npm install -g pnpm"));
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
      console.log(chalk12.yellow("\n\u26A0\uFE0F  Supabase CLI nicht gefunden"));
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
    },
    {
      title: "Supabase PAT laden (f\xFCr Management API)",
      task: async (ctx, task) => {
        debug(ctx, `Suche nach SUPABASE_PAT...`);
        ctx.supabasePat = loadSupabasePat();
        if (ctx.supabasePat) {
          debug(ctx, `PAT gefunden: ${ctx.supabasePat.substring(0, 15)}...`);
          task.title = "Supabase PAT geladen \u2713 (vollautomatische Schema-Konfiguration)";
        } else {
          debug(ctx, "Kein PAT gefunden");
          task.title = "Supabase PAT nicht gefunden (Migration-Fallback)";
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
    init_config();
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
      title: "1/12: GitHub Repository erstellen",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: GitHub Repository w\xFCrde erstellt werden`);
          task.title = "1/12: GitHub Repository (DRY-RUN) \u2713";
          return Promise.resolve();
        }
        writeLog(`Task 1/12: GitHub Repository`, "TASK");
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
          task.title = "1/12: GitHub Repository \u26A0 (Token fehlt - manuell erstellen)";
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
            task.title = `1/12: GitHub Repository existiert bereits \u2713 (${existingRepo.html_url})`;
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
          task.title = `1/12: GitHub Repository erstellt \u2713 (${repo.html_url})`;
        } catch (error) {
          debug(taskCtx, `\u2717 GitHub Fehler: ${error.message}`);
          writeLog(`GitHub Fehler: ${error.message}`, "ERROR");
          if (error.message.includes("Timeout")) {
            task.title = `1/12: GitHub Repository \u26A0 (Timeout - manuell pr\xFCfen)`;
            return;
          }
          if (error.message.includes("already exists") || error.status === 422) {
            task.title = `1/12: GitHub Repository existiert bereits \u26A0`;
            return;
          }
          task.title = `1/12: GitHub Repository \u2717 (${error.message})`;
          throw error;
        }
      }
    },
    {
      title: "2/12: Template klonen",
      task: async (taskCtx, task) => {
        debug(taskCtx, `Pr\xFCfe Zielverzeichnis: ${finalProjectPath}`);
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Template w\xFCrde geklont werden nach ${finalProjectPath}`);
          task.title = "2/12: Template klonen (DRY-RUN) \u2713";
          return;
        }
        if (fs6.existsSync(finalProjectPath)) {
          const files = fs6.readdirSync(finalProjectPath);
          if (files.length > 0) {
            debug(taskCtx, `Verzeichnis existiert bereits mit ${files.length} Dateien`);
            if (fs6.existsSync(path6.join(finalProjectPath, "package.json"))) {
              debug(taskCtx, `Bestehendes Kessel-Projekt gefunden, \xFCberspringe Klonen`);
              task.title = "2/12: Bestehendes Projekt verwendet \u2713";
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
          task.title = "2/12: Template geklont \u2713";
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
            task.title = "2/12: Template geklont (degit) \u2713";
            initializeLog();
          } catch (degitError) {
            debug(taskCtx, `Degit auch fehlgeschlagen: ${degitError.message}`);
            task.title = `2/12: Template klonen \u2717`;
            throw new Error(`Git: ${error.message}, Degit: ${degitError.message}`);
          }
        }
      }
    },
    {
      title: "3/12: Bootstrap-Credentials (.env)",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: .env w\xFCrde erstellt werden`);
          task.title = "3/12: .env (DRY-RUN) \u2713";
          return;
        }
        const envContent = `# Bootstrap-Credentials f\xFCr Vault-Zugriff (INFRA-DB)
# WICHTIG: Dies ist die URL der INFRA-DB (Kessel) mit integriertem Vault
NEXT_PUBLIC_SUPABASE_URL=${config.infraDb.url}
SERVICE_ROLE_KEY=${config.serviceRoleKey}
`;
        fs6.writeFileSync(path6.join(finalProjectPath, ".env"), envContent);
        task.title = "3/12: .env erstellt \u2713";
      }
    },
    {
      title: "4/12: Public-Credentials (.env.local)",
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
          task.title = "4/12: .env.local (DRY-RUN) \u2713";
          return;
        }
        const cleanAnonKey = ctx.anonKey.replace(/\x1b\[[0-9;]*m/g, "").replace(/\u001b\[\d+m/g, "").trim();
        const cleanServiceRoleKey = ctx.serviceRoleKey.replace(/\x1b\[[0-9;]*m/g, "").replace(/\u001b\[\d+m/g, "").trim();
        const envLocalContent = `# Public-Credentials f\xFCr Next.js Client
# Multi-Tenant Architektur: INFRA-DB (Auth, Vault) + DEV-DB (App-Daten)
# Jedes Projekt hat ein eigenes Schema f\xFCr Daten-Isolation

# INFRA-DB (Kessel) - Auth, Vault, Multi-Tenant
NEXT_PUBLIC_SUPABASE_URL=${config.infraDb.url}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${cleanAnonKey}
NEXT_PUBLIC_PROJECT_SCHEMA=${config.schemaName}

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
        task.title = "4/12: .env.local erstellt \u2713";
      }
    },
    {
      title: "5/12: Git initialisieren",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Git w\xFCrde initialisiert werden`);
          task.title = "5/12: Git initialisieren (DRY-RUN) \u2713";
          return;
        }
        const gitDir = path6.join(finalProjectPath, ".git");
        if (!fs6.existsSync(gitDir)) {
          execSync("git init", { cwd: finalProjectPath, stdio: "ignore" });
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
        task.title = "5/12: Git initialisiert \u2713";
      }
    },
    {
      title: "6/12: Dependencies installieren",
      task: async (taskCtx, task) => {
        if (!config.autoInstallDeps) {
          task.skip("Dependencies-Installation \xFCbersprungen");
          return;
        }
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Dependencies w\xFCrden installiert werden`);
          task.title = "6/12: Dependencies installieren (DRY-RUN) \u2713";
          return;
        }
        const installCmd = ctx.packageManager?.installCommand || "pnpm install";
        execSync(installCmd, { cwd: finalProjectPath, stdio: "inherit" });
        task.title = "6/12: Dependencies installiert \u2713";
      },
      skip: () => !config.autoInstallDeps
    },
    {
      title: "7/12: Supabase Link",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Supabase w\xFCrde verlinkt werden`);
          task.title = "7/12: Supabase Link (DRY-RUN) \u2713";
          return;
        }
        try {
          execSync(`supabase link --project-ref ${config.infraDb.projectRef}`, {
            cwd: finalProjectPath,
            stdio: "pipe"
          });
          task.title = "7/12: INFRA-DB verlinkt \u2713";
        } catch (error) {
          task.title = "7/12: Supabase Link \u26A0 (nicht kritisch)";
        }
      }
    },
    {
      title: "8/12: Multi-Tenant Schema konfigurieren",
      task: async (taskCtx, task) => {
        debug(taskCtx, `Konfiguriere Schema: ${config.schemaName}`);
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Schema w\xFCrde konfiguriert werden`);
          task.title = `8/12: Schema "${config.schemaName}" (DRY-RUN) \u2713`;
          return;
        }
        let dbPassword = null;
        if (ctx.serviceRoleKey && config.infraDb?.url) {
          try {
            const { fetchDbPasswordFromVault: fetchDbPasswordFromVault2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
            dbPassword = await fetchDbPasswordFromVault2(
              config.infraDb.url,
              ctx.serviceRoleKey,
              (msg) => debug(taskCtx, msg)
            );
          } catch (vaultError) {
            debug(taskCtx, `Vault-Zugriff fehlgeschlagen: ${vaultError.message}`);
          }
        }
        if (!dbPassword && process.env.SUPABASE_DB_PASSWORD) {
          dbPassword = process.env.SUPABASE_DB_PASSWORD;
          debug(taskCtx, `DB-Passwort aus Umgebungsvariable verwendet`);
        }
        if (!dbPassword && config.dbPassword) {
          dbPassword = config.dbPassword;
          debug(taskCtx, `DB-Passwort aus Wizard-Config verwendet`);
        }
        let schemaCreatedViaRpc = false;
        if (ctx.serviceRoleKey && config.infraDb?.url) {
          try {
            debug(taskCtx, `Versuche Schema via RPC einzurichten...`);
            const { ensureTenantSchemaViaRpc: ensureTenantSchemaViaRpc2, addSchemaToPostgrestConfig: addSchemaToPostgrestConfig2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
            const rpcResult = await ensureTenantSchemaViaRpc2(
              config.infraDb.url,
              ctx.serviceRoleKey,
              config.schemaName,
              verbose
            );
            if (rpcResult.success) {
              debug(taskCtx, `Schema "${config.schemaName}" via RPC: ${rpcResult.message}`);
              schemaCreatedViaRpc = true;
              if (ctx.supabasePat) {
                debug(taskCtx, `Aktualisiere PostgREST-Config via Management API...`);
                const mgmtResult = await addSchemaToPostgrestConfig2(
                  config.infraDb.projectRef,
                  ctx.supabasePat,
                  config.schemaName,
                  verbose
                );
                if (mgmtResult.success) {
                  debug(taskCtx, `PostgREST-Config aktualisiert: ${mgmtResult.schemas.join(", ")}`);
                  ctx.schemaManualSetup = false;
                  ctx.migrationPending = false;
                  task.title = `8/12: Schema "${config.schemaName}" + PostgREST \u2713`;
                  return;
                } else {
                  debug(taskCtx, `Management API fehlgeschlagen: ${mgmtResult.error}`);
                }
              } else {
                debug(taskCtx, `Kein PAT vorhanden - PostgREST muss manuell konfiguriert werden`);
              }
            } else if (rpcResult.needsSetup) {
              debug(taskCtx, `RPC-Funktion nicht installiert, versuche PG-Fallback...`);
            } else {
              debug(taskCtx, `RPC fehlgeschlagen: ${rpcResult.error}`);
            }
          } catch (rpcError) {
            debug(taskCtx, `RPC-Aufruf fehlgeschlagen: ${rpcError.message}`);
          }
        }
        if (dbPassword) {
          try {
            debug(taskCtx, `Versuche Schema via direkter PG-Verbindung...`);
            const { applySchemaViaPg: applySchemaViaPg2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
            await applySchemaViaPg2(
              config.infraDb.projectRef,
              config.schemaName,
              dbPassword,
              verbose
            );
            debug(taskCtx, `Schema "${config.schemaName}" + PostgREST erfolgreich konfiguriert`);
            ctx.schemaManualSetup = false;
            ctx.migrationPending = false;
            task.title = `8/12: Schema "${config.schemaName}" + PostgREST \u2713`;
            return;
          } catch (pgError) {
            debug(taskCtx, `PostgreSQL-Verbindung fehlgeschlagen: ${pgError.message}`);
          }
        }
        const migrationDir = path6.join(finalProjectPath, "supabase", "migrations");
        if (!fs6.existsSync(migrationDir)) {
          fs6.mkdirSync(migrationDir, { recursive: true });
        }
        const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:T]/g, "").slice(0, 14);
        const migrationFile = path6.join(migrationDir, `${timestamp}_setup_schema_${config.schemaName}.sql`);
        let migrationSql;
        if (schemaCreatedViaRpc) {
          debug(taskCtx, `Schema via RPC erstellt - erstelle PostgREST-Migration`);
          migrationSql = `-- Migration: PostgREST-Konfiguration f\xFCr Schema "${config.schemaName}"
-- Erstellt von Kessel CLI am ${(/* @__PURE__ */ new Date()).toISOString()}
-- 
-- Das Schema und Grants wurden via RPC erstellt.
-- Diese Migration konfiguriert nur PostgREST.

-- PostgREST Schema-Konfiguration
-- WICHTIG: Passe die Liste an wenn weitere Schemas hinzukommen!
ALTER ROLE authenticator 
  SET pgrst.db_schemas = 'public, infra, ${config.schemaName}, storage, graphql_public, realtime';

-- PostgREST Reload
SELECT pg_notify('pgrst', 'reload config');
`;
        } else {
          debug(taskCtx, `Erstelle vollst\xE4ndige Schema-Migration`);
          migrationSql = `-- Migration: Setup Multi-Tenant Schema "${config.schemaName}"
-- Erstellt von Kessel CLI am ${(/* @__PURE__ */ new Date()).toISOString()}
-- 
-- WICHTIG: Diese Migration konfiguriert sowohl das Schema als auch PostgREST
-- damit PGRST106 Fehler vermieden werden.

-- 1. Schema erstellen falls nicht vorhanden
CREATE SCHEMA IF NOT EXISTS "${config.schemaName}";

-- 2. Grants f\xFCr authenticated und anon Roles
GRANT USAGE ON SCHEMA "${config.schemaName}" TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA "${config.schemaName}" TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA "${config.schemaName}" TO anon;

-- 3. Default privileges f\xFCr zuk\xFCnftige Tabellen
ALTER DEFAULT PRIVILEGES IN SCHEMA "${config.schemaName}" 
  GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "${config.schemaName}" 
  GRANT SELECT ON TABLES TO anon;

-- 4. KRITISCH: PostgREST Schema-Konfiguration f\xFCr authenticator Role
-- Ohne diese Konfiguration wirft PostgREST PGRST106 Fehler!
ALTER ROLE authenticator 
  SET pgrst.db_schemas = 'public, infra, ${config.schemaName}, storage, graphql_public, realtime';

-- 5. PostgREST Reload
SELECT pg_notify('pgrst', 'reload config');
`;
        }
        fs6.writeFileSync(migrationFile, migrationSql);
        debug(taskCtx, `Migration-Datei erstellt: ${migrationFile}`);
        ctx.migrationPending = true;
        ctx.schemaManualSetup = false;
        ctx.schemaMigrationFile = migrationFile;
        task.title = `8/12: Schema-Migration erstellt \u2713 (pnpm db:migrate)`;
      }
    },
    {
      title: "9/12: Datenbank-Migrationen",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Migrationen w\xFCrden ausgef\xFChrt werden`);
          task.title = "9/12: Migrationen (DRY-RUN) \u2713";
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
        task.title = "9/12: Migrationen \u26A0 (manuell: pnpm db:migrate)";
        ctx.migrationPending = true;
      }
    },
    {
      title: "10/12: Standard-User pr\xFCfen",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Standard-User w\xFCrden erstellt werden`);
          task.title = "10/12: Standard-User (DRY-RUN) \u2713";
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
          task.title = "10/12: Standard-User erstellt \u2713";
        } catch (error) {
          task.title = "10/12: Standard-User \u26A0";
        }
      }
    },
    {
      title: "11/12: Vercel Link",
      task: async (taskCtx, task) => {
        if (!config.linkVercel) {
          task.skip("Vercel Link \xFCbersprungen");
          return;
        }
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Vercel w\xFCrde verlinkt werden`);
          task.title = "11/12: Vercel Link (DRY-RUN) \u2713";
          return;
        }
        try {
          execSync("vercel link --yes", {
            cwd: finalProjectPath,
            stdio: "pipe"
          });
          task.title = "11/12: Vercel verlinkt \u2713";
        } catch (error) {
          task.title = "11/12: Vercel Link \u26A0 (nicht kritisch)";
        }
      },
      skip: () => !config.linkVercel
    },
    {
      title: "12/12: MCP-Konfiguration aktualisieren",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: MCP-Konfiguration w\xFCrde aktualisiert werden`);
          task.title = "12/12: MCP-Konfiguration (DRY-RUN) \u2713";
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
        task.title = "12/12: MCP-Konfiguration aktualisiert \u2713";
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
        writeLog(`Schema: ${config.schemaName}`, "INFO");
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
function App({ projectNameArg, verbose, dryRun, onComplete, onError }) {
  useEffect(() => {
    process.stdout.write("\x1B[2J\x1B[H");
  }, []);
  const [phase, setPhase] = useState("wizard");
  const [config, setConfig] = useState(null);
  const [ctx, setCtx] = useState({});
  const [tasks, setTasks] = useState([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  config?.projectPath || null;
  config?.projectName || projectNameArg || path6.basename(process.cwd());
  const handleWizardComplete = (wizardConfig) => {
    setConfig(wizardConfig);
    setPhase("prechecks");
  };
  const [precheckTasksInit, setPrecheckTasksInit] = useState(false);
  useEffect(() => {
    if (phase === "prechecks" && config && !precheckTasksInit) {
      const precheckTasks = createPrecheckTasks(config, { verbose });
      setTasks(precheckTasks.tasks || []);
      setCurrentTaskIndex(0);
      setPrecheckTasksInit(true);
    }
  }, [phase, config, verbose, precheckTasksInit]);
  const [setupTasksInit, setSetupTasksInit] = useState(false);
  useEffect(() => {
    if (phase === "setup" && config && !setupTasksInit) {
      const setupTasks = createSetupTasks(config, { verbose });
      setTasks(setupTasks.tasks || []);
      setCurrentTaskIndex(0);
      setSetupTasksInit(true);
    }
  }, [phase, config, verbose, setupTasksInit]);
  const [createTasksInit, setCreateTasksInit] = useState(false);
  useEffect(() => {
    const projectPathFromConfig = config?.projectPath;
    if (phase === "create" && config && projectPathFromConfig && !createTasksInit) {
      const createTasks = createProjectTasks(config, ctx, projectPathFromConfig, { verbose, dryRun });
      setTasks(createTasks.tasks || []);
      setCurrentTaskIndex(0);
      setCreateTasksInit(true);
    }
  }, [phase, config, ctx, verbose, dryRun, createTasksInit]);
  const handleTasksComplete = () => {
    if (phase === "prechecks") {
      setPhase("setup");
    } else if (phase === "setup") {
      setPhase("create");
    } else if (phase === "create") {
      setPhase("success");
    }
  };
  useEffect(() => {
    if (phase === "success" && config && onComplete) {
      onComplete({ config, ctx, projectPath: config?.projectPath });
    }
  }, [phase, config, ctx, onComplete]);
  const handleError = (error) => {
    if (onError) {
      onError(error);
    }
  };
  return /* @__PURE__ */ React4.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React4.createElement(Banner, null), dryRun && /* @__PURE__ */ React4.createElement(Text, { color: "yellow", bold: true, marginTop: 1 }, "\u26A0\uFE0F  DRY-RUN MODUS: Keine Dateien werden erstellt oder ge\xE4ndert"), phase === "wizard" && /* @__PURE__ */ React4.createElement(
    Wizard,
    {
      projectNameArg,
      onComplete: handleWizardComplete,
      onError: handleError
    }
  ), phase === "prechecks" && /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true, marginTop: 1 }, "PHASE 1: PRE-CHECKS"), /* @__PURE__ */ React4.createElement(
    TaskList,
    {
      tasks,
      ctx,
      setCtx,
      verbose,
      onComplete: handleTasksComplete,
      onError: handleError
    }
  )), phase === "setup" && /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true, marginTop: 1 }, "PHASE 2: SETUP"), /* @__PURE__ */ React4.createElement(
    TaskList,
    {
      tasks,
      ctx,
      setCtx,
      verbose,
      onComplete: handleTasksComplete,
      onError: handleError
    }
  )), phase === "create" && /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement(Text, { color: "cyan", bold: true, marginTop: 1 }, "PHASE 3: PROJEKT-ERSTELLUNG"), /* @__PURE__ */ React4.createElement(
    TaskList,
    {
      tasks,
      ctx,
      setCtx,
      verbose,
      onComplete: handleTasksComplete,
      onError: handleError
    }
  )), phase === "success" && config && config.projectPath && /* @__PURE__ */ React4.createElement(Success, { config, ctx, projectPath: config.projectPath, dryRun }));
}
var init_App = __esm({
  "src/components/App.jsx"() {
    init_Banner();
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
function openBrowser(url) {
  const platform = process.platform;
  let command;
  if (platform === "win32") {
    command = `start "" "${url}"`;
  } else if (platform === "darwin") {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  exec(command, (err) => {
    if (err) {
      console.log(chalk12.yellow(`
\u{1F4F1} Browser konnte nicht automatisch ge\xF6ffnet werden.`));
      console.log(chalk12.yellow(`   \xD6ffne manuell: ${url}`));
    }
  });
}
function startDevServer(projectPath, packageManagerName) {
  console.log(chalk12.cyan(`
\u{1F680} Starte Dev-Server in ${projectPath}...
`));
  const devCmd = packageManagerName === "npm" ? "npm" : "pnpm";
  const devProcess = spawn(devCmd, ["run", "dev"], {
    cwd: projectPath,
    stdio: ["inherit", "pipe", "pipe"],
    shell: true
  });
  let browserOpened = false;
  let detectedPort = null;
  const parsePort = (data) => {
    const output = data.toString();
    process.stdout.write(output);
    const portMatch = output.match(/localhost:(\d+)/);
    if (portMatch && !detectedPort) {
      detectedPort = portMatch[1];
    }
    if ((output.includes("Ready") || output.includes("\u2713 Ready")) && !browserOpened && detectedPort) {
      browserOpened = true;
      console.log(chalk12.green(`
\u2713 Dev-Server bereit auf Port ${detectedPort}`));
      openBrowser(`http://localhost:${detectedPort}`);
    }
  };
  devProcess.stdout.on("data", parsePort);
  devProcess.stderr.on("data", (data) => {
    const output = data.toString();
    process.stderr.write(output);
    parsePort(data);
  });
  devProcess.on("error", (err) => {
    console.error(chalk12.red(`
\u274C Fehler beim Starten des Dev-Servers: ${err.message}`));
    console.error(chalk12.yellow(`   Bitte manuell starten: cd ${path6.basename(projectPath)} && ${devCmd} dev`));
    process.exit(1);
  });
  devProcess.on("close", (code) => {
    process.exit(code || 0);
  });
}
async function runInitCommand(projectNameArg, options) {
  const verbose = options.verbose || false;
  const dryRun = options.dryRun || false;
  if (!process.stdin.isTTY) {
    console.error(chalk12.red.bold("\n\u274C Fehler: Diese CLI ben\xF6tigt ein interaktives Terminal."));
    console.error(chalk12.yellow("   Bitte f\xFChre die CLI in einem Terminal aus (nicht in einem Pipe oder Script).\n"));
    process.exit(1);
  }
  process.stdout.write("\x1B[2J\x1B[H");
  let result = null;
  let hasError = null;
  try {
    const instance = render(
      /* @__PURE__ */ React4.createElement(
        App,
        {
          projectNameArg,
          verbose,
          dryRun,
          onComplete: ({ config, ctx, projectPath }) => {
            result = { config, ctx, projectPath };
          },
          onError: (error) => {
            hasError = error;
            instance.unmount();
          }
        }
      ),
      {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr
      }
    );
    await instance.waitUntilExit();
    if (hasError) {
      throw hasError;
    }
    if (result && result.config && result.config.startDevServer === true && !dryRun) {
      startDevServer(result.projectPath, result.ctx?.packageManager?.name);
    } else if (result) {
      return result;
    }
  } catch (error) {
    console.error(chalk12.red.bold("\n\u274C Fehler:"));
    console.error(chalk12.red(error.message));
    process.exit(1);
  }
}
var init_init = __esm({
  "src/commands/init.jsx"() {
    init_App();
  }
});
function renderStatusTable(title, items) {
  console.log(chalk12.white.bold(`
  ${title}`));
  for (const item of items) {
    const icon = item.status === "ok" ? chalk12.green("\u2713") : item.status === "warning" ? chalk12.yellow("\u26A0") : item.status === "error" ? chalk12.red("\u2717") : chalk12.gray("\u25CB");
    const statusText = item.detail ? chalk12.gray(item.detail) : "";
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
  console.log(chalk12.cyan.bold(`
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
        console.error(chalk12.red("\u274C SERVICE_ROLE_KEY nicht gefunden. Bitte konfiguriere die .env Datei."));
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
          console.warn(chalk12.yellow("\u26A0 Schema-Cache noch nicht aktualisiert. Verwende Fallback..."));
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
              console.warn(chalk12.yellow("\u26A0 Versuche direkten SQL-Fallback..."));
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
          console.error(chalk12.red(`\u274C Secret "${secretName}" nicht gefunden`));
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
        console.log(chalk12.cyan.bold(`
\u{1F4CB} Secrets (${entries.length}):
`));
        entries.forEach(([key, value]) => {
          const preview = value.length > 50 ? value.substring(0, 50) + "..." : value;
          console.log(chalk12.white(`  ${key.padEnd(40)} ${chalk12.dim(preview)}`));
        });
        console.log();
      }
    } catch (error) {
      console.error(chalk12.red.bold("\n\u274C Fehler beim Abrufen der Secrets:"));
      console.error(chalk12.red(error.message));
      debugError(error, verbose);
      console.error(chalk12.dim("\n\u{1F4A1} Tipp: Verwende --verbose f\xFCr detaillierte Debug-Informationen"));
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
        console.error(chalk12.red("\u274C SERVICE_ROLE_KEY nicht gefunden."));
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
            console.error(chalk12.red(`\u274C Secret "${secretName}" existiert bereits`));
            console.error(chalk12.yellow(`   Verwende --force um zu \xFCberschreiben
`));
            process.exit(1);
          }
        } catch (error2) {
        }
      }
      console.log(chalk12.blue(`\u{1F4DD} F\xFCge Secret "${secretName}" hinzu...`));
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
            console.log(chalk12.green(`\u2713 Secret "${secretName}" erfolgreich hinzugef\xFCgt`));
            console.log(chalk12.dim(`  UUID: ${httpResult.data}
`));
            return;
          } catch (httpError) {
            debugError(httpError, verbose);
            throw new Error("Schema-Cache noch nicht aktualisiert.");
          }
        }
        throw error;
      }
      console.log(chalk12.green(`\u2713 Secret "${secretName}" erfolgreich hinzugef\xFCgt`));
      console.log(chalk12.dim(`  UUID: ${data}
`));
    } catch (error) {
      console.error(chalk12.red.bold("\n\u274C Fehler beim Hinzuf\xFCgen des Secrets:"));
      console.error(chalk12.red(error.message));
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
        console.error(chalk12.red("\u274C SERVICE_ROLE_KEY nicht gefunden."));
        process.exit(1);
      }
      const supabase = createClient(config.defaultSupabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      console.log(chalk12.blue(`\u{1F50D} Pr\xFCfe ob Secret "${secretName}" existiert...`));
      let existingValue = null;
      try {
        const { data: data2, error } = await supabase.rpc("read_secret", {
          secret_name: secretName
        });
        if (error) {
          if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
            console.error(chalk12.red(`\u274C Secret "${secretName}" existiert nicht`));
            console.error(chalk12.yellow(`   Verwende "secrets add" um ein neues Secret hinzuzuf\xFCgen
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
          console.error(chalk12.red(`\u274C Secret "${secretName}" existiert nicht`));
          process.exit(1);
        }
        throw error;
      }
      if (existingValue === secretValue) {
        console.log(chalk12.yellow(`\u26A0 Secret "${secretName}" hat bereits diesen Wert`));
        process.exit(0);
      }
      console.log(chalk12.blue(`\u{1F504} Aktualisiere Secret "${secretName}"...`));
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
          console.log(chalk12.green(`\u2713 Secret "${secretName}" erfolgreich aktualisiert`));
          console.log(chalk12.dim(`  UUID: ${httpResult.data}
`));
          return;
        }
        throw insertError;
      }
      console.log(chalk12.green(`\u2713 Secret "${secretName}" erfolgreich aktualisiert`));
      console.log(chalk12.dim(`  UUID: ${data}
`));
    } catch (error) {
      console.error(chalk12.red.bold("\n\u274C Fehler beim Aktualisieren des Secrets:"));
      console.error(chalk12.red(error.message));
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
        console.error(chalk12.red("\u274C SERVICE_ROLE_KEY nicht gefunden."));
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
          console.log(chalk12.yellow("Abgebrochen."));
          process.exit(0);
        }
      }
      console.log(chalk12.blue(`\u{1F5D1}\uFE0F  L\xF6sche Secret "${secretName}"...`));
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
          console.log(chalk12.green(`\u2713 Secret "${secretName}" erfolgreich gel\xF6scht
`));
          return;
        }
        if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
          console.error(chalk12.red(`\u274C Secret "${secretName}" existiert nicht`));
          process.exit(1);
        }
        throw error;
      }
      console.log(chalk12.green(`\u2713 Secret "${secretName}" erfolgreich gel\xF6scht
`));
    } catch (error) {
      console.error(chalk12.red.bold("\n\u274C Fehler beim L\xF6schen des Secrets:"));
      console.error(chalk12.red(error.message));
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
    console.log(chalk12.green(`\u2713 ${name}: ${value}`));
  }
}
var init_secrets = __esm({
  "src/commands/secrets.js"() {
    init_config();
    init_debug();
    init_supabase();
  }
});

// src/commands/infra.js
var infra_exports = {};
__export(infra_exports, {
  registerInfraCommands: () => registerInfraCommands
});
function registerInfraCommands(infraCommand2) {
  infraCommand2.command("setup-rpc").description("Installiert die Schema-Management RPC-Funktionen in der INFRA-DB").option("-v, --verbose", "Detaillierte Debug-Ausgaben").option("--force", "\xDCberschreibt existierende Funktionen").action(async (options) => {
    const verbose = !!options.verbose;
    try {
      console.log(chalk12.cyan.bold("\n\u{1F527} Installiere Schema-Management Funktionen...\n"));
      const config = loadConfig();
      const serviceRoleKey = loadServiceRoleKey();
      if (!serviceRoleKey) {
        console.error(chalk12.red("\u274C SERVICE_ROLE_KEY nicht gefunden. Bitte konfiguriere die .env Datei."));
        process.exit(1);
      }
      if (!options.force) {
        const isAvailable = await isSchemaManagementAvailable(config.defaultSupabaseUrl, serviceRoleKey);
        if (isAvailable) {
          console.log(chalk12.yellow("\u26A0 Schema-Management Funktionen sind bereits installiert."));
          console.log(chalk12.gray("  Verwende --force um zu \xFCberschreiben.\n"));
          process.exit(0);
        }
      }
      const sql = ENSURE_TENANT_SCHEMA_SQL;
      debugLog("SQL geladen", { length: sql.length }, verbose);
      console.log(chalk12.cyan("\u{1F4CB} Folgendes SQL wird ausgef\xFChrt:\n"));
      console.log(chalk12.gray("\u2500".repeat(60)));
      console.log(chalk12.gray(sql.split("\n").slice(0, 20).join("\n")));
      console.log(chalk12.gray("... (weitere Zeilen)"));
      console.log(chalk12.gray("\u2500".repeat(60)));
      const projectRef = config.defaultSupabaseUrl.split("//")[1].split(".")[0];
      const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
      console.log(chalk12.yellow("\n\u26A0 Diese Funktion muss direkt im Supabase SQL Editor ausgef\xFChrt werden."));
      console.log(chalk12.cyan("\n\u{1F4DD} So gehst du vor:\n"));
      console.log("   1. \xD6ffne: " + chalk12.underline(dashboardUrl));
      console.log("   2. Kopiere das SQL (wurde in Zwischenablage kopiert)");
      console.log("   3. F\xFCge ein und f\xFChre aus (Run)");
      console.log("   4. Fertig! Schema-Management ist jetzt verf\xFCgbar.\n");
      try {
        const { execSync: execSync5 } = await import('child_process');
        const fs10 = await import('fs');
        const os3 = await import('os');
        const path12 = await import('path');
        const tmpFile = path12.join(os3.tmpdir(), "kessel_schema_setup.sql");
        fs10.writeFileSync(tmpFile, sql);
        if (process.platform === "win32") {
          execSync5(`type "${tmpFile}" | clip`, { stdio: "pipe", shell: true });
          console.log(chalk12.green("\u2713 SQL wurde in die Zwischenablage kopiert!\n"));
        } else if (process.platform === "darwin") {
          execSync5(`cat "${tmpFile}" | pbcopy`, { stdio: "pipe" });
          console.log(chalk12.green("\u2713 SQL wurde in die Zwischenablage kopiert!\n"));
        } else {
          try {
            execSync5(`cat "${tmpFile}" | xclip -selection clipboard`, { stdio: "pipe" });
            console.log(chalk12.green("\u2713 SQL wurde in die Zwischenablage kopiert!\n"));
          } catch {
            console.log(chalk12.gray("\n\u{1F4CB} SQL f\xFCr manuelles Kopieren:\n"));
            console.log(sql);
          }
        }
        fs10.unlinkSync(tmpFile);
      } catch (e) {
        console.log(chalk12.gray("\n\u{1F4CB} SQL f\xFCr manuelles Kopieren:\n"));
        console.log(sql);
      }
    } catch (error) {
      console.error(chalk12.red.bold("\n\u274C Fehler:"));
      console.error(chalk12.red(error.message));
      debugError(error, verbose);
      process.exit(1);
    }
  });
  infraCommand2.command("ensure-schema").description("Richtet ein neues Multi-Tenant Schema in der INFRA-DB ein").argument("<schema-name>", "Name des Schemas (lowercase, nur Buchstaben, Zahlen und Unterstriche)").option("-v, --verbose", "Detaillierte Debug-Ausgaben").action(async (schemaName, options) => {
    const verbose = !!options.verbose;
    try {
      console.log(chalk12.cyan.bold(`
\u{1F527} Richte Schema "${schemaName}" ein...
`));
      const config = loadConfig();
      const serviceRoleKey = loadServiceRoleKey();
      if (!serviceRoleKey) {
        console.error(chalk12.red("\u274C SERVICE_ROLE_KEY nicht gefunden."));
        process.exit(1);
      }
      const result = await ensureTenantSchemaViaRpc(
        config.defaultSupabaseUrl,
        serviceRoleKey,
        schemaName,
        verbose
      );
      if (result.success && result.schemasExposed && !result.schemasExposed.includes("manuell")) {
        console.log(chalk12.green(`\u2713 ${result.message}`));
        console.log(chalk12.gray(`  PostgREST Schemas: ${result.schemasExposed}
`));
        return;
      }
      if (result.success) {
        console.log(chalk12.green(`\u2713 Schema "${schemaName}" + Grants erstellt`));
        const pat = loadSupabasePat();
        const projectRef = config.defaultSupabaseUrl.split("//")[1].split(".")[0];
        if (pat) {
          console.log(chalk12.cyan("  Aktualisiere PostgREST-Config via Management API..."));
          const mgmtResult = await addSchemaToPostgrestConfig(projectRef, pat, schemaName, verbose);
          if (mgmtResult.success) {
            console.log(chalk12.green(`\u2713 PostgREST-Config aktualisiert`));
            console.log(chalk12.gray(`  Schemas: ${mgmtResult.schemas.join(", ")}
`));
            console.log(chalk12.green.bold(`\u{1F389} Schema "${schemaName}" ist jetzt vollst\xE4ndig eingerichtet!
`));
            return;
          } else {
            console.log(chalk12.yellow(`  \u26A0 Management API fehlgeschlagen: ${mgmtResult.error}`));
          }
        } else {
          debugLog("Kein PAT gefunden - Management API nicht verf\xFCgbar", null, verbose);
        }
        const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
        console.log(chalk12.cyan("\n\u{1F4DD} PostgREST manuell konfigurieren (Dashboard oder Migration):"));
        console.log(chalk12.gray("\u2500".repeat(50)));
        console.log(chalk12.white(`
-- F\xFCge Schema zur PostgREST-Konfiguration hinzu
ALTER ROLE authenticator 
  SET pgrst.db_schemas = 'public, infra, storage, graphql_public, realtime, ${schemaName}';
SELECT pg_notify('pgrst', 'reload config');
`));
        console.log(chalk12.gray("\u2500".repeat(50)));
        console.log(chalk12.cyan(`
\u2192 Dashboard: ${dashboardUrl}`));
        console.log(chalk12.yellow("\n\u{1F4A1} Tipp: Speichere SUPABASE_PAT in .env f\xFCr automatische Konfiguration\n"));
        return;
      }
      if (result.needsSetup) {
        console.error(chalk12.red("\u274C Schema-Management Funktionen nicht installiert."));
        console.log(chalk12.yellow("\n\u{1F4A1} F\xFChre zuerst aus: kessel infra setup-rpc\n"));
        process.exit(1);
      } else {
        console.error(chalk12.red(`\u274C Fehler: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk12.red.bold("\n\u274C Fehler:"));
      console.error(chalk12.red(error.message));
      debugError(error, verbose);
      process.exit(1);
    }
  });
  infraCommand2.command("list-schemas").description("Listet alle Tenant-Schemas in der INFRA-DB").option("-v, --verbose", "Detaillierte Debug-Ausgaben").action(async (options) => {
    const verbose = !!options.verbose;
    try {
      const config = loadConfig();
      const serviceRoleKey = loadServiceRoleKey();
      if (!serviceRoleKey) {
        console.error(chalk12.red("\u274C SERVICE_ROLE_KEY nicht gefunden."));
        process.exit(1);
      }
      const result = await callRpcViaHttp(
        config.defaultSupabaseUrl,
        serviceRoleKey,
        "list_tenant_schemas",
        {},
        verbose,
        "infra"
        // Schema-Prefix
      );
      if (result.error) {
        if (result.error.message?.includes("does not exist")) {
          console.error(chalk12.red("\u274C Schema-Management Funktionen nicht installiert."));
          console.log(chalk12.yellow("\n\u{1F4A1} F\xFChre zuerst aus: kessel infra setup-rpc\n"));
        } else {
          console.error(chalk12.red(`\u274C Fehler: ${result.error.message || result.error}`));
        }
        process.exit(1);
      }
      const schemas = result.data || [];
      if (schemas.length === 0) {
        console.log(chalk12.yellow("\n\u26A0 Keine Tenant-Schemas gefunden.\n"));
      } else {
        console.log(chalk12.cyan.bold(`
\u{1F4CB} Tenant-Schemas (${schemas.length}):
`));
        schemas.forEach((schema) => {
          console.log(chalk12.white(`  \u2022 ${schema}`));
        });
        console.log();
      }
    } catch (error) {
      console.error(chalk12.red.bold("\n\u274C Fehler:"));
      console.error(chalk12.red(error.message));
      debugError(error, verbose);
      process.exit(1);
    }
  });
  infraCommand2.command("status").description("Zeigt Status der INFRA-DB und Schema-Management").option("-v, --verbose", "Detaillierte Debug-Ausgaben").action(async (options) => {
    const verbose = !!options.verbose;
    try {
      console.log(chalk12.cyan.bold("\n\u{1F4CA} INFRA-DB Status\n"));
      const config = loadConfig();
      const serviceRoleKey = loadServiceRoleKey();
      console.log(chalk12.white("DB-URL:           ") + chalk12.gray(config.defaultSupabaseUrl || "nicht konfiguriert"));
      console.log(chalk12.white("Service Role Key: ") + (serviceRoleKey ? chalk12.green("\u2713 vorhanden") : chalk12.red("\u2717 fehlt")));
      if (!serviceRoleKey) {
        console.log();
        process.exit(0);
      }
      const isAvailable = await isSchemaManagementAvailable(config.defaultSupabaseUrl, serviceRoleKey);
      console.log(chalk12.white("Schema-Management:") + (isAvailable ? chalk12.green(" \u2713 installiert") : chalk12.yellow(" \u2717 nicht installiert")));
      if (!isAvailable) {
        console.log(chalk12.gray("\n  \u2192 Installiere mit: kessel infra setup-rpc"));
      }
      console.log();
    } catch (error) {
      console.error(chalk12.red.bold("\n\u274C Fehler:"));
      console.error(chalk12.red(error.message));
      debugError(error, verbose);
      process.exit(1);
    }
  });
}
var ENSURE_TENANT_SCHEMA_SQL;
var init_infra = __esm({
  "src/commands/infra.js"() {
    init_config();
    init_debug();
    init_supabase();
    ENSURE_TENANT_SCHEMA_SQL = `
-- ============================================================
-- Kessel Multi-Tenant Schema Management
-- ============================================================

-- 1. Infra-Schema erstellen falls nicht vorhanden
CREATE SCHEMA IF NOT EXISTS infra;

-- 2. Die Management-Funktion (vereinfacht - PostgREST-Schemas sind vorregistriert)
CREATE OR REPLACE FUNCTION infra.ensure_tenant_schema(p_schema_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validierung: Schema-Name darf nur lowercase, zahlen und underscore enthalten
  IF p_schema_name !~ '^[a-z][a-z0-9_]*$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid schema name. Use lowercase letters, numbers, and underscores only.',
      'schema', p_schema_name
    );
  END IF;

  -- Reservierte Namen blockieren
  IF p_schema_name IN ('public', 'auth', 'storage', 'realtime', 'graphql_public', 'extensions', 'pg_catalog', 'information_schema', 'infra') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reserved schema name.',
      'schema', p_schema_name
    );
  END IF;

  -- 1. Schema erstellen
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema_name);

  -- 2. Grants f\xFCr authenticated und anon
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated, anon', p_schema_name);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated', p_schema_name);
  EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO anon', p_schema_name);

  -- 3. Default privileges f\xFCr zuk\xFCnftige Tabellen
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO authenticated', p_schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO anon', p_schema_name);

  -- 4. PostgREST Reload (Schema-Cache aktualisieren)
  PERFORM pg_notify('pgrst', 'reload schema');

  -- Fertig! PostgREST-Schemas sind vorregistriert
  RETURN jsonb_build_object(
    'success', true,
    'schema', p_schema_name,
    'message', format('Schema "%s" + Grants erstellt', p_schema_name)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'schema', p_schema_name
  );
END;
$$;

-- 3. Permissions
REVOKE ALL ON FUNCTION infra.ensure_tenant_schema(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION infra.ensure_tenant_schema(text) TO service_role;

-- 4. Hilfsfunktion: Liste aller Tenant-Schemas
CREATE OR REPLACE FUNCTION infra.list_tenant_schemas()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(schema_name ORDER BY schema_name), '[]'::jsonb)
  FROM information_schema.schemata
  WHERE schema_name NOT IN (
    'public', 'auth', 'storage', 'realtime', 'graphql_public', 
    'extensions', 'pg_catalog', 'information_schema', 'infra',
    'supabase_migrations', 'supabase_functions', 'vault', 'pgsodium',
    'pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'pgbouncer', 'net'
  )
  AND schema_name NOT LIKE 'pg_%'
  AND schema_name NOT LIKE '\\_%';
$$;

REVOKE ALL ON FUNCTION infra.list_tenant_schemas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION infra.list_tenant_schemas() TO service_role;
`;
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
var CLI_VERSION2 = "2.2.0";
var BOILERPLATE_VERSION = getBoilerplateVersion();
program.name("kessel").description("CLI f\xFCr die Kessel Boilerplate - Erstellt neue Next.js-Projekte mit Supabase & ShadCN UI").version(CLI_VERSION2).configureOutput({
  writeOut: (str) => process.stdout.write(str),
  writeErr: (str) => process.stderr.write(str)
});
program.command("version").description("Zeigt CLI und Boilerplate Version").action(() => {
  console.log(`Kessel CLI: v${CLI_VERSION2}`);
  console.log(`Boilerplate: v${BOILERPLATE_VERSION}`);
});
program.argument("[project-name]", "Name des Projekts (optional)").option("-v, --verbose", "Detaillierte Debug-Ausgaben", false).option("--dry-run", "Simuliert Projekt-Erstellung ohne Dateien zu erstellen", false).action(async (projectNameArg, options) => {
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
var infraCommand = program.command("infra").description("Verwaltet die INFRA-DB Konfiguration und Multi-Tenant Schemas");
var { registerInfraCommands: registerInfraCommands2 } = await Promise.resolve().then(() => (init_infra(), infra_exports));
registerInfraCommands2(infraCommand);
program.parse(process.argv);
