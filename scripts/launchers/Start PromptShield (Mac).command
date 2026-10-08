#!/bin/bash
# Double-click to start PromptShield. Keep the Terminal window open while you use it.
cd "$(dirname "$0")/../.." || exit 1
CHECK='const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'

NODE=""
for n in node /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.volta/bin/node"; do
  if command -v "$n" >/dev/null 2>&1 && "$n" -e "$CHECK" >/dev/null 2>&1; then NODE="$n"; break; fi
done

if [ -z "$NODE" ]; then
  echo
  echo "  PromptShield needs Node.js (free), version 22.13 or newer."
  echo "    1. Your browser will now open the Node.js website."
  echo "    2. Download the \"LTS\" macOS Installer (.pkg) and run it."
  echo "    3. Double-click \"Start PromptShield (Mac)\" again."
  echo
  open "https://nodejs.org/en/download" 2>/dev/null || true
  read -n 1 -s -r -p "  Press any key to close this window."
  exit 1
fi

echo
echo "  Starting PromptShield..."
echo
"$NODE" --disable-warning=ExperimentalWarning scripts/launch.mjs
echo
echo "  PromptShield has stopped. If you see an error above, check \"START HERE.txt\"."
read -n 1 -s -r -p "  Press any key to close this window."
