# GitHub Workflow Guide: Private Org Repo (Free Plan)

This workflow uses **Local Safety Guardrails** to prevent accidental pushes to `main`. It supports both dedicated and **shared laptops** via mode switching.

---

## 1. Initial Setup (One-time)
Every team member must install the repo-tracked hooks to enable local branch protection.

### Step A: Update `.gitignore`
Add `.gitguard.mode` to your project's `.gitignore` file to ensure local mode settings are not committed.
```text
.gitguard.mode
```

### Step B: Install Hooks
Run the appropriate installer for your environment. This will also create your local `.gitguard.mode` file (defaulting to JUNIOR).

**Windows (PowerShell):**
```powershell
./scripts/install-git-hooks.ps1
```

**Mac / Linux / Git Bash:**
```bash
chmod +x scripts/install-git-hooks.sh
./scripts/install-git-hooks.sh
```

---

## 2. Shared Laptop Procedure (OWNER vs. JUNIOR)
If a junior is using the Owner's laptop, the mode MUST be toggled accordingly.

### Switch to JUNIOR Mode (When Junior works)
Blocks pushes to `main`. Use this when Junaid is working on your laptop.
- **PowerShell:** `./scripts/set-mode-junior.ps1`
- **Bash/Git Bash:** `./scripts/set-mode-junior.sh`

### Switch to OWNER Mode (When Owner works)
Allows pushes to `main`. Run this when you take your laptop back.
- **PowerShell:** `./scripts/set-mode-owner.ps1`
- **Bash/Git Bash:** `./scripts/set-mode-owner.sh`

---

## 3. Junior Workflow (Junaid & Ehteshan)
Juniors must always work on lowercase, task-specific feature branches.

### Step 1: Create a Feature Branch
```bash
# Ensure local main is current
git checkout main
git pull origin main

# Create and switch to your feature branch
# Format: <name>/<task-description>
git checkout -b junaid/api-fix

# Link branch to origin on first push
git push -u origin junaid/api-fix
```

### Step 2: Push Changes & Open PR
```bash
git add .
git commit -m "feat: fixed api timeout issue"
git push
```
1. Go to GitHub and open a **Pull Request**.
2. **Base:** `main` | **Compare:** `junaid/api-fix`
3. **Reviewer:** Assign the **Owner**.

---

## 4. Owner Workflow (Review & Merge)
The owner follows this flow to pull, fetch, merge, and push.

```bash
# 1. Prepare local main
git checkout main
git pull origin main

# 2. Fetch origin to get the feature branch(es)
git fetch origin

# 3. Merge with No-Fast-Forward (preserves history)
git merge --no-ff origin/junaid/api-fix -m "Merge: Junaid's API fix"

# 4. Push to main (Ensure you are in OWNER mode!)
git push origin main
```

---

## 5. Verification Steps (Testing the Guardrail)

### Test 1: Junior Block (Verification)
1. Run `./scripts/set-mode-junior` (ps1 or sh).
2. Switch to main: `git checkout main`.
3. Attempt push: `git push origin main`.
4. **Result:** Must be BLOCKED with a "🛑 GUARD BLOCK" message.

### Test 2: Owner Allow (Verification)
1. Run `./scripts/set-mode-owner` (ps1 or sh).
2. Switch to main: `git checkout main`.
3. Attempt push: `git push origin main`.
4. **Result:** Must ALLOW the push (or show "Everything up-to-date").
