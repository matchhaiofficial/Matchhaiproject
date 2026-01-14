#!/bin/bash
# scripts/set-mode-owner.sh
# Switch workflow to OWNER mode
printf "OWNER" > .gitguard.mode
echo "✅ Mode set to OWNER. You can now push to main."
