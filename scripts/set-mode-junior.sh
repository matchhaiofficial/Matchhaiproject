#!/bin/bash
# scripts/set-mode-junior.sh
# Switch workflow to JUNIOR mode
printf "JUNIOR" > .gitguard.mode
echo "✅ Mode set to JUNIOR. Pushing to main is now BLOCKED."
