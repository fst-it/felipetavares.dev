#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Push a filtered public snapshot to github.com/fst-it/felipetavares.dev.

.DESCRIPTION
  Builds a new commit from HEAD with docs/superpowers/ excluded, runs safety checks,
  then force-pushes that commit to the public repo's main branch.
  Never touches the local working tree or index.

  Exclusions (see $EXCLUDE_PATHS): docs/superpowers (personal specs and ledger),
  design-mockup HTML/ZIP files with client names. All stay local-only.

  Safety checks before push:
    1. docs/superpowers must be absent from the filtered tree.
    2. git grep must find no sensitive patterns (company names, personal paths, email).

.PARAMETER Message
  Commit subject line. Defaults to "feat: public snapshot".

.EXAMPLE
  pwsh scripts/export-public.ps1
  pwsh scripts/export-public.ps1 -Message "feat: add reading section"
#>
param(
    [string]$Message = "feat: public snapshot"
)

$ErrorActionPreference = 'Stop'

$PUBLIC_REMOTE = 'https://github.com/fst-it/felipetavares.dev.git'

# Paths removed from every public export. Add entries here for any file/dir that must stay local.
$EXCLUDE_PATHS = @(
    'docs/superpowers',                             # personal specs, complaint ledger — local only
    'docs/AI Brain Hero Options (standalone).html', # design mockup with client names
    'docs/AI Brain Circuit Prototype.zip'           # binary design archive
)

# Patterns that must not appear in the exported tree (company names, personal machine paths, email).
$DENY_PATTERNS = @('eneco', 'heineken', 'felipesouza', 'C:\dev\career_plan')

# ── 1. Verify clean working tree ──────────────────────────────────────────────
Write-Host '[export-public] Checking working tree...'
$dirty = git status --porcelain
if ($LASTEXITCODE -ne 0) { Write-Host '[export-public] ERROR: git status failed' -ForegroundColor Red; exit 1 }
if ($dirty) {
    Write-Host "[export-public] ABORT: working tree is not clean.`n$dirty" -ForegroundColor Red
    exit 1
}
Write-Host '[export-public] Working tree clean.'

# ── 2. Build filtered tree in a temporary index ───────────────────────────────
# Uses GIT_INDEX_FILE to operate on a temp index, leaving the real index untouched.
$tmpIndex = Join-Path ([System.IO.Path]::GetTempPath()) "git-export-idx-$([System.Guid]::NewGuid().ToString('N'))"
[string]$treeSha = ''

try {
    $env:GIT_INDEX_FILE = $tmpIndex

    Write-Host '[export-public] Populating temp index from HEAD...'
    git read-tree HEAD
    if ($LASTEXITCODE -ne 0) { Write-Host '[export-public] ERROR: git read-tree failed' -ForegroundColor Red; exit 1 }

    foreach ($excludePath in $EXCLUDE_PATHS) {
        # Check whether path exists in the index before trying to remove it.
        $inIndex = git ls-files --cached $excludePath
        if ($inIndex) {
            Write-Host "[export-public] Removing $excludePath from temp index..."
            git rm -r --cached --quiet $excludePath
            if ($LASTEXITCODE -ne 0) { Write-Host "[export-public] ERROR: git rm --cached $excludePath failed" -ForegroundColor Red; exit 1 }
        } else {
            Write-Host "[export-public] $excludePath not in index, skipping."
        }
    }

    Write-Host '[export-public] Writing filtered tree...'
    $treeSha = (git write-tree).Trim()
    if ($LASTEXITCODE -ne 0) { Write-Host '[export-public] ERROR: git write-tree failed' -ForegroundColor Red; exit 1 }

    Write-Host "[export-public] Tree: $treeSha"
}
finally {
    Remove-Item -Path 'Env:GIT_INDEX_FILE' -ErrorAction SilentlyContinue
    Remove-Item -Path $tmpIndex -Force -ErrorAction SilentlyContinue
}

if (-not $treeSha) {
    Write-Host '[export-public] ERROR: no tree SHA produced' -ForegroundColor Red
    exit 1
}

# ── 3. Safety checks ─────────────────────────────────────────────────────────
Write-Host '[export-public] Safety check: excluded paths must be absent from tree...'
[string[]]$treeFiles = git ls-tree -r --name-only $treeSha
if ($LASTEXITCODE -ne 0) { Write-Host '[export-public] ERROR: git ls-tree failed' -ForegroundColor Red; exit 1 }

foreach ($excludePath in $EXCLUDE_PATHS) {
    $leaked = $treeFiles | Where-Object { $_ -like "$excludePath*" }
    if ($leaked) {
        Write-Host "[export-public] ABORT: $excludePath still present in filtered tree:`n$($leaked -join "`n")" -ForegroundColor Red
        exit 1
    }
}
Write-Host '[export-public] Excluded paths absent. OK.'

Write-Host '[export-public] Safety check: scanning filtered tree for sensitive patterns...'
$grepArgs = [System.Collections.Generic.List[string]]@('-i')
foreach ($pat in $DENY_PATTERNS) {
    $grepArgs.Add('-e')
    $grepArgs.Add($pat)
}
$grepArgs.Add($treeSha)
# Exclude this script itself: it necessarily contains the patterns it checks for.
$grepArgs.Add('--')
$grepArgs.Add(':(exclude)scripts/export-public.ps1')

$grepOutput = & git grep @grepArgs 2>&1
$grepExit   = $LASTEXITCODE

if ($grepExit -eq 0) {
    # exit 0 means matches were found — abort
    Write-Host "[export-public] ABORT: sensitive content found in filtered tree:`n$grepOutput" -ForegroundColor Red
    exit 1
}
if ($grepExit -ne 1) {
    # exit 1 means no matches (good); anything else is a git error
    Write-Host "[export-public] ERROR: git grep failed (exit $grepExit):`n$grepOutput" -ForegroundColor Red
    exit 1
}
Write-Host '[export-public] No sensitive patterns found. OK.'

# ── 4. Create orphan commit ───────────────────────────────────────────────────
Write-Host '[export-public] Creating snapshot commit...'
$exclusionSummary = $EXCLUDE_PATHS -join ', '
$commitMsg = "$Message`n`nFiltered fresh-start export: $exclusionSummary excluded.`n`nCo-Authored-By: Claude <noreply@anthropic.com>"

# Write message to a temp file so multiline content reaches git commit-tree cleanly on Windows.
$msgFile = Join-Path ([System.IO.Path]::GetTempPath()) "git-commit-msg-$([System.Guid]::NewGuid().ToString('N')).txt"
try {
    [System.IO.File]::WriteAllText($msgFile, $commitMsg, [System.Text.Encoding]::UTF8)
    $commitSha = (git commit-tree $treeSha -F $msgFile).Trim()
    if ($LASTEXITCODE -ne 0) { Write-Host '[export-public] ERROR: git commit-tree failed' -ForegroundColor Red; exit 1 }
}
finally {
    Remove-Item -Path $msgFile -Force -ErrorAction SilentlyContinue
}

Write-Host "[export-public] Commit: $commitSha"

# ── 5. Push ───────────────────────────────────────────────────────────────────
Write-Host "[export-public] Pushing to $PUBLIC_REMOTE ..."
git push $PUBLIC_REMOTE "${commitSha}:refs/heads/main" --force
if ($LASTEXITCODE -ne 0) { Write-Host '[export-public] ERROR: git push failed' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '[export-public] Push complete.' -ForegroundColor Green
Write-Host "  commit : $commitSha"
Write-Host "  tree   : $treeSha"
