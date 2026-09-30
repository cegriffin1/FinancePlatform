#!/usr/bin/env bash
# Kill ONLY FinancePlatform Next listeners on known recovery ports.
# Run from a local Terminal if the Cursor agent cannot signal those PIDs.
set -euo pipefail
ROOT="/Users/charlesgriffin/Projects/FinancePlatform"
PORTS=(3000 3001 3010 3011)
for port in "${PORTS[@]}"; do
  while read -r pid; do
    [ -z "${pid:-}" ] && continue
    cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1 || true)
    if [ "$cwd" = "$ROOT" ]; then
      echo "Stopping pid=$pid port=$port cwd=$cwd"
      kill -TERM "$pid" 2>/dev/null || true
      sleep 0.5
      kill -KILL "$pid" 2>/dev/null || true
    else
      echo "Skip pid=$pid port=$port cwd=${cwd:-unknown}"
    fi
  done < <(lsof -iTCP:"$port" -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR>1{print $2}' | sort -u)
done
echo "Remaining listeners:"
lsof -iTCP:3000,3001,3010,3011 -sTCP:LISTEN -n -P 2>/dev/null || echo "(none)"
