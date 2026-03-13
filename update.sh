#!/usr/bin/env bash
# Kessel CLI updaten und global verfuegbar machen
# Einfach ausfuehren: ./update.sh

set -e

cd "$(dirname "$0")"

echo "🔄 Kessel CLI updaten..."
echo ""

# 1. Neuesten Code holen
echo "📥 Git pull..."
git pull origin main

# 2. Dependencies installieren/updaten
echo "📦 Dependencies installieren..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 3. Global verlinken
echo "🔗 Global verlinken..."
pnpm link --global 2>/dev/null || npm link

# 4. Pruefen
echo ""
echo "✅ Fertig! Version:"
kessel version 2>/dev/null || node dist/cli.mjs version 2>/dev/null || echo "   (kessel version nicht verfuegbar -- ggf. Terminal neu oeffnen)"
echo ""
echo "Jetzt kannst du loslegen:"
echo "   kessel mein-projekt"
