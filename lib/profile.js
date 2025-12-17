import fs from "fs"
import path from "path"
import os from "os"

/**
 * Normalisiert einen Username (Umlaute zu ASCII)
 * @param {string} username - Der zu normalisierende Username
 * @returns {string} - Normalisierter Username
 */
export function normalizeUsername(username) {
  if (!username || typeof username !== "string") {
    throw new Error("Username muss ein nicht-leerer String sein")
  }

  return username
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "") // Entferne alle nicht-alphanumerischen Zeichen
}

/**
 * Gibt den Pfad zum Profil-Verzeichnis zurück (~/.kessel)
 * @returns {string} - Pfad zum Profil-Verzeichnis
 */
export function getProfileDir() {
  const homeDir = os.homedir()
  return path.join(homeDir, ".kessel")
}

/**
 * Gibt den Pfad zu einer Profil-Datei zurück
 * @param {string} username - Der Username (wird normalisiert)
 * @returns {string} - Pfad zur Profil-Datei
 */
export function getProfilePath(username) {
  const normalized = normalizeUsername(username)
  const profileDir = getProfileDir()
  
  // Stelle sicher, dass das Verzeichnis existiert
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true, mode: 0o700 })
  }
  
  return path.join(profileDir, `${normalized}.kesselprofile`)
}

/**
 * Lädt ein Profil aus einer Datei
 * @param {string} username - Der Username (wird normalisiert)
 * @returns {Object|null} - Profil-Objekt oder null wenn nicht gefunden
 */
export function loadProfile(username) {
  if (!username || typeof username !== "string") {
    return null
  }

  try {
    const profilePath = getProfilePath(username)
    
    if (!fs.existsSync(profilePath)) {
      return null
    }

    const content = fs.readFileSync(profilePath, "utf-8")
    const profile = {}

    // Parse .env-Format
    const lines = content.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Überspringe Kommentare und leere Zeilen
      if (!trimmed || trimmed.startsWith("#")) {
        continue
      }

      // Parse KEY=VALUE Format
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim()
        
        // Entferne Anführungszeichen falls vorhanden
        const unquotedValue = value.replace(/^["']|["']$/g, "")
        profile[key] = unquotedValue
      }
    }

    return Object.keys(profile).length > 0 ? profile : null
  } catch (error) {
    // Fehler beim Laden = kein Profil vorhanden
    return null
  }
}

/**
 * Speichert ein Profil in eine Datei (.env-Format)
 * @param {string} username - Der Username (wird normalisiert)
 * @param {Object} profile - Profil-Objekt mit Key-Value-Paaren
 * @returns {string} - Pfad zur gespeicherten Profil-Datei
 */
export function saveProfile(username, profile) {
  if (!username || typeof username !== "string") {
    throw new Error("Username muss ein nicht-leerer String sein")
  }

  if (!profile || typeof profile !== "object") {
    throw new Error("Profil muss ein Objekt sein")
  }

  const profilePath = getProfilePath(username)
  const profileDir = path.dirname(profilePath)

  // Stelle sicher, dass das Verzeichnis existiert
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true, mode: 0o700 })
  }

  // Erstelle .env-Format Content
  const lines = []
  lines.push(`# Kessel-Profil für ${username}`)
  lines.push(`# Erstellt: ${new Date().toISOString()}`)
  lines.push("")

  // Schreibe Key-Value-Paare
  for (const [key, value] of Object.entries(profile)) {
    // Escape spezielle Zeichen im Value
    const escapedValue = String(value).replace(/\n/g, "\\n")
    lines.push(`${key}=${escapedValue}`)
  }

  const content = lines.join("\n")

  // Schreibe Datei mit sicheren Berechtigungen (600 auf Unix)
  fs.writeFileSync(profilePath, content, { mode: 0o600 })

  return profilePath
}

/**
 * Prüft ob ein Profil existiert
 * @param {string} username - Der Username (wird normalisiert)
 * @returns {boolean} - true wenn Profil existiert
 */
export function profileExists(username) {
  if (!username || typeof username !== "string") {
    return false
  }

  try {
    const profilePath = getProfilePath(username)
    return fs.existsSync(profilePath)
  } catch {
    return false
  }
}
