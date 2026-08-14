[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $output = & git -C $repoRoot @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
    }
    return $output
}

try {
    Invoke-Git rev-parse --is-inside-work-tree | Out-Null

    $changes = @(Invoke-Git status --porcelain)
    if ($changes.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace(($changes -join ""))) {
        Write-Output "Visionex sync skipped: local changes are present and were preserved."
        exit 0
    }

    Invoke-Git fetch --prune origin | Out-Null
    $branch = (Invoke-Git branch --show-current | Select-Object -First 1).Trim()

    if ($branch -ne "main") {
        Write-Output "Visionex fetch complete. Current branch '$branch' was not changed."
        exit 0
    }

    $ahead = [int]((Invoke-Git rev-list --count origin/main..HEAD | Select-Object -First 1).Trim())
    if ($ahead -gt 0) {
        Write-Output "Visionex sync skipped: local main has $ahead unpublished commit(s)."
        exit 0
    }

    $behind = [int]((Invoke-Git rev-list --count HEAD..origin/main | Select-Object -First 1).Trim())
    if ($behind -eq 0) {
        Write-Output "Visionex is already up to date."
        exit 0
    }

    Invoke-Git merge --ff-only origin/main | Out-Null
    $revision = (Invoke-Git rev-parse --short HEAD | Select-Object -First 1).Trim()
    Write-Output "Visionex updated safely to $revision ($behind new commit(s))."
}
catch {
    Write-Error "Visionex sync failed: $($_.Exception.Message)"
    exit 1
}
