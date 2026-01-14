#!/bin/bash
# scripts/install-git-hooks.sh
# Install Git hooks (Mac/Linux/Git Bash)

HOOK_SRC="scripts/hooks/pre-push"
HOOK_DEST=".git/hooks/pre-push"
MODE_FILE=".gitguard.mode"

if [ ! -f "$HOOK_SRC" ]; then
    echo "❌ Error: $HOOK_SRC not found. Ensure you are in the repo root."
    exit 1
fi

# 1. Create .gitguard.mode locally if missing (default JUNIOR)
if [ ! -f "$MODE_FILE" ]; then
    printf "JUNIOR" > "$MODE_FILE"
    echo "✅ Created local $MODE_FILE (Default: JUNIOR)"
fi

# 2. Install hook
mkdir -p .git/hooks
cp "$HOOK_SRC" "$HOOK_DEST"

# 3. Set executable permissions
chmod +x "$HOOK_DEST"
chmod +x scripts/set-mode-owner.sh 2>/dev/null
chmod +x scripts/set-mode-junior.sh 2>/dev/null

echo "✅ Git hooks installed to $HOOK_DEST"
echo "✅ Script permissions updated."
