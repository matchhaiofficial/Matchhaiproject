# scripts/install-git-hooks.ps1
# Install Git hooks (Windows PowerShell)

$hookSrc = "scripts/hooks/pre-push"
$hookDest = ".git/hooks/pre-push"
$modeFile = ".gitguard.mode"

if (-not (Test-Path $hookSrc)) {
    Write-Error "❌ Error: $hookSrc not found. Ensure you are in the repo root."
    exit 1
}

# 1. Create .gitguard.mode locally if missing (default JUNIOR)
if (-not (Test-Path $modeFile)) {
    "JUNIOR" | Out-File -FilePath $modeFile -Encoding ascii -NoNewline
    Write-Host "✅ Created local $modeFile (Default: JUNIOR)" -ForegroundColor Cyan
}

# 2. Install hook
if (-not (Test-Path ".git/hooks")) {
    New-Item -ItemType Directory -Path ".git/hooks" -Force | Out-Null
}

# Preserve LF/UTF8 for Git Bash compatibility (UTF8 No BOM)
$content = [System.IO.File]::ReadAllText($hookSrc)
[System.IO.File]::WriteAllText($hookDest, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "✅ Git hooks installed to $hookDest (UTF8 No BOM)" -ForegroundColor Green
