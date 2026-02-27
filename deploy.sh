#!/usr/bin/env bash
set -euo pipefail

# Deploy script for running on Raspberry Pi (or any local machine).
# Generates the site and deploys to Cloudflare Pages via wrangler.
#
# Prerequisites:
#   - bun (https://bun.sh)
#   - wrangler (`bun add -g wrangler` or `npm i -g wrangler`)
#   - CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID set in environment
#     (e.g. via ~/.config/misogi/.env or exported in your shell)
#
# Usage:
#   ./deploy.sh                  # generate + deploy
#   ./deploy.sh --generate-only  # just generate, skip deploy
#   ./deploy.sh --deploy-only    # just deploy existing out/, skip generate

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --- Configuration ---
CLOUDFLARE_PROJECT="${CLOUDFLARE_PROJECT:-seattleindie-club}"
ENV_FILE="${MISOGI_ENV_FILE:-$HOME/.config/misogi/.env}"
LOG_FILE="${MISOGI_LOG_FILE:-/tmp/misogi-deploy.log}"

# --- Load .env if it exists ---
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# --- Validate environment ---
check_env() {
  local missing=0
  if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN is not set" >&2
    missing=1
  fi
  if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
    echo "ERROR: CLOUDFLARE_ACCOUNT_ID is not set" >&2
    missing=1
  fi
  if [[ $missing -eq 1 ]]; then
    echo "Set these in $ENV_FILE or export them in your shell." >&2
    exit 1
  fi
}

# --- Parse flags ---
DO_GENERATE=true
DO_DEPLOY=true

for arg in "$@"; do
  case "$arg" in
    --generate-only) DO_DEPLOY=false ;;
    --deploy-only)   DO_GENERATE=false ;;
    --help|-h)
      echo "Usage: $0 [--generate-only | --deploy-only]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

# --- Logging ---
log() {
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$timestamp] $*" | tee -a "$LOG_FILE"
}

# --- Generate ---
generate() {
  log "Installing dependencies..."
  bun install --frozen-lockfile 2>&1 | tail -1

  log "Generating site (RUN_MODE=prod)..."
  bun run generate:prod

  log "Copying static assets to out/..."
  cp -r static/* out/

  log "Generation complete. Output in out/"
}

# --- Deploy ---
deploy() {
  check_env

  log "Deploying to Cloudflare Pages (project: $CLOUDFLARE_PROJECT)..."
  wrangler pages deploy out/ \
    --project-name="$CLOUDFLARE_PROJECT" \
    --commit-dirty=true

  log "Deploy complete."
}

# --- Main ---
log "=== misogi deploy started ==="

if [[ "$DO_GENERATE" == true ]]; then
  generate
fi

if [[ "$DO_DEPLOY" == true ]]; then
  deploy
fi

log "=== misogi deploy finished ==="
