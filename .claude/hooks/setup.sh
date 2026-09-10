#!/usr/bin/env sh
# Hook SessionStart: prepara l'ambiente (locale o cloud) senza mai fallire la sessione.
# - Avvisa se Node è troppo vecchio per node:sqlite (server non avviabile).
# - In cloud (CLAUDE_CODE_REMOTE=true) installa sempre le devDependencies con npm install:
#   lo stato del container viene messo in cache dopo l'hook e il comando è idempotente.
# - In locale installa con npm ci solo se manca node_modules, per npm run build.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if ! command -v node >/dev/null 2>&1; then
  echo "[setup] Node non trovato: serve Node >= 22.12 (node:sqlite). Il server non potrà partire."
elif ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)'; then
  echo "[setup] Node $(node -v) troppo vecchio: serve >= 22.12 (node:sqlite). Il build funziona, il server no."
fi

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if npm install --no-audit --no-fund --loglevel=error >/dev/null 2>&1; then
    echo "[setup] devDependencies installate (npm install, sessione remota)."
  else
    echo "[setup] npm install non riuscito: eseguilo a mano prima di npm run build."
  fi
elif [ ! -d node_modules ]; then
  if npm ci --no-audit --no-fund --loglevel=error >/dev/null 2>&1; then
    echo "[setup] devDependencies installate (npm ci)."
  else
    echo "[setup] npm ci non riuscito: eseguilo a mano prima di npm run build."
  fi
fi
exit 0
