#!/usr/bin/env bash
# Starts TrueForge in the background so it survives closing the terminal.
# Run it from WSL:  bash start-trueforge.sh
set -euo pipefail

# nvm only loads in interactive shells, so without this "node" is not found.
# shellcheck disable=SC1091
source ~/.nvm/nvm.sh 2>/dev/null || true

# NB: match the node entrypoint, never the bare word "trueforge" - this script's own
# filename contains that word, so a naive pkill would kill the shell running it.
pkill -f "trueforge/dist/main.js" 2>/dev/null || true
sleep 2

# Strip proxy variables: a stale HTTP(S)_PROXY in the environment breaks the
# sandboxed subprocesses that execute code (this caused the sandbox ProxyError).
#
# TrueForge enables an SSRF guard (NETWORK_POLICY_ENABLED defaults to true) that blocks
# requests to localhost, which is where our own MCP server runs. Allowlisting localhost
# and 127.0.0.1 keeps the guard on for every other host.
export OUTBOUND_URL_ALLOWED_HOSTS='["localhost","127.0.0.1"]'

env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
    -u ALL_PROXY -u all_proxy \
    setsid nohup npx @truefoundry/trueforge@latest > "$HOME/trueforge.log" 2>&1 < /dev/null &

sleep 15
echo "--- trueforge.log (tail) ---"
tail -12 "$HOME/trueforge.log"
echo "--- listening? ---"
curl -s -o /dev/null -w "http://localhost:8790 => %{http_code}\n" http://localhost:8790