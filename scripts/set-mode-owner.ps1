# scripts/set-mode-owner.ps1
@'
OWNER
'@ | Out-File -FilePath .gitguard.mode -Encoding ascii -NoNewline
Write-Host "✅ Mode set to OWNER. You can now push to main." -ForegroundColor Green
