# push-chunks.ps1 — POST all chat chunks to the fst-vectorize-admin Worker for embedding + upsert.
#
# Prerequisites:
#   1. Worker is deployed (see scripts/vectorize-upsert/README.md)
#   2. src/generated/chat-chunks.upsert.ndjson exists (run `pnpm build-chat-index --upsert` first)
#
# Usage:
#   .\scripts\vectorize-upsert\push-chunks.ps1 -WorkerUrl <url> -AdminToken <token>
#
# Example:
#   .\scripts\vectorize-upsert\push-chunks.ps1 `
#     -WorkerUrl "https://fst-vectorize-admin.YOUR-ACCOUNT.workers.dev" `
#     -AdminToken "your-random-token"

param(
    [Parameter(Mandatory)][string]$WorkerUrl,
    [Parameter(Mandatory)][string]$AdminToken
)

$ndjsonPath = Join-Path $PSScriptRoot "..\..\src\generated\chat-chunks.upsert.ndjson"
$batchSize = 10
$tempDir = [System.IO.Path]::GetTempPath()

if (-not (Test-Path $ndjsonPath)) {
    Write-Error "chat-chunks.upsert.ndjson not found at $ndjsonPath. Run 'pnpm build-chat-index --upsert' first."
    exit 1
}

# Health check
Write-Output "Checking worker health at $WorkerUrl ..."
$health = curl -s -H "Authorization: Bearer $AdminToken" "$WorkerUrl/health" 2>&1
Write-Output "Health: $health"
if ($health -notmatch '"ok":true') {
    Write-Error "Worker health check failed. Verify the URL and token."
    exit 1
}

# Read ndjson and assign sequential IDs to avoid collision bug in chunker
# (multiple sources share the same url, causing id collisions like /#0 appearing twice)
$lines = Get-Content $ndjsonPath
$chunks = @()
$idx = 0
foreach ($line in $lines) {
    $obj = $line | ConvertFrom-Json
    $chunks += [PSCustomObject]@{
        id       = "chunk-$idx"
        metadata = $obj.metadata
    }
    $idx++
}
Write-Output "Loaded $($chunks.Count) chunks from ndjson."

$totalUpserted = 0
$batchNum = 0

for ($start = 0; $start -lt $chunks.Count; $start += $batchSize) {
    $end = [Math]::Min($start + $batchSize - 1, $chunks.Count - 1)
    $batch = $chunks[$start..$end]

    $batchFile = Join-Path $tempDir "fst-vect-batch-$batchNum.json"
    $batch | ConvertTo-Json -Depth 10 | Set-Content -Path $batchFile -Encoding UTF8

    Write-Output "Posting batch $batchNum (items $start-$end) ..."
    $result = curl -s -X POST "$WorkerUrl/upsert" `
        -H "Authorization: Bearer $AdminToken" `
        -H "Content-Type: application/json" `
        --data-binary "@$batchFile" 2>&1

    Write-Output "  -> $result"

    try {
        $parsed = $result | ConvertFrom-Json
        if ($parsed.ok) { $totalUpserted += $parsed.upserted }
        else { Write-Warning "Batch $batchNum reported an error." }
    } catch {
        Write-Warning "Could not parse response for batch $batchNum."
    }

    Remove-Item $batchFile -ErrorAction SilentlyContinue
    $batchNum++
}

Write-Output ""
Write-Output "Done. Upserted $totalUpserted / $($chunks.Count) chunks."
Write-Output ""
Write-Output "Verify with: npx wrangler vectorize info fst-chat"
Write-Output "(Run from the site root, not from this directory.)"
Write-Output ""
Write-Output "Delete the worker when done:"
Write-Output "  cd scripts/vectorize-upsert/worker && npx wrangler delete fst-vectorize-admin"
