#!/usr/bin/env bash
# Starts the rubric MCP server in the background so it survives closing the terminal.
# Run it from WSL:  bash start-mcp.sh
set -euo pipefail
cd "$(dirname "$0")"

# nvm only loads in interactive shells, so without this "node" is not found.
# shellcheck disable=SC1091
source ~/.nvm/nvm.sh 2>/dev/null || true

# Restart cleanly if one is already running.
pkill -f "mcp-server.mjs" 2>/dev/null || true
sleep 1

# Strip proxy variables: a stale HTTP(S)_PROXY in the environment breaks any
# subprocess that tries to reach the network (this caused the sandbox ProxyError).
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
    -u ALL_PROXY -u all_proxy \
    setsid nohup node mcp-server.mjs > "$HOME/rubric-mcp.log" 2>&1 < /dev/null &

sleep 3
echo "--- rubric-mcp.log ---"
cat "$HOME/rubric-mcp.log"
echo "--- listening? ---"
curl -s -o /dev/null -w "http://localhost:8941/mcp => %{http_code}\n" http://localhost:8941/mcp