#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Jasmin Redžepagić
# Serve TopologyDrafter locally. ES modules need http://, not file://.
set -euo pipefail

PORT="${1:-8770}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="http://localhost:${PORT}/"

echo "TopologyDrafter → ${URL}"
echo "Ctrl-C to stop."

if command -v xdg-open >/dev/null 2>&1; then
  ( sleep 1; xdg-open "$URL" >/dev/null 2>&1 || true ) &
fi

exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR"
