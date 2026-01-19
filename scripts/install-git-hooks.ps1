# scripts/install-git-hooks.ps1
# Install Git hooks (Windows PowerShell) - repo-root safe

$ErrorActionPreference = "Stop"

# Resolve actual repo root (works no matter where script is executed from)
$repoRoot = (git rev-parse --show-toplevel).Trim()

$hookSrc  = Join-Path $repoRoot "scripts/hooks/pre-push"
$hookDest = Join-Path $repoRoot ".git/hooks/pre-push"
$modeFile = Join-Path $repoRoot ".gitguard.mode"

if (-not (Test-Path $hookSrc)) {
  throw "Hook source not found: $hookSrc"
}

# Create .gitguard.mode locally if missing (default JUNIOR)
if (-not (Test-Path $modeFile)) {
  "JUNIOR" | Out-File -FilePath $modeFile -Encoding ascii -NoNewline
  Write-Host "✅ Created local .gitguard.mode (Default: JUNIOR)" -ForegroundColor Cyan
}

# Ensure hooks directory exists
$hooksDir = Split-Path $hookDest -Parent
New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null

# Write hook as UTF8 No BOM (Git Bash compatible)
$content = [System.IO.File]::ReadAllText($hookSrc)
[System.IO.File]::WriteAllText($hookDest, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "✅ Git hooks installed to $hookDest (UTF8 No BOM)" -ForegroundColor Green
