# scripts/set-mode-junior.ps1
@'
JUNIOR
'@ | Out-File -FilePath .gitguard.mode -Encoding ascii -NoNewline
Write-Host "✅ Mode set to JUNIOR. Pushing to main is now BLOCKED." -ForegroundColor Yellow
