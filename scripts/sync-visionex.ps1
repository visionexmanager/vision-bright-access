[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    # Windows PowerShell 5.1 wraps every stderr line from a native command in an
    # ErrorRecord, and with $ErrorActionPreference = "Stop" that record is fatal
    # even when the command exited 0. git reports routine progress on stderr —
    # "From https://github.com/..." — so this function used to throw exactly when
    # a fetch had something new to report, which is the only time the script has
    # any work to do. It appeared to work only while the machine was up to date.
    #
    # Drop to "Continue" for the call, split the two streams apart, and let git's
    # exit code alone decide success.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $captured = & git -C $repoRoot @Arguments 2>&1
    }
    finally {
        $ErrorActionPreference = $previous
    }
    $exitCode = $LASTEXITCODE

    $stdout = @($captured | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } | ForEach-Object { [string]$_ })
    $stderr = @($captured | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] } | ForEach-Object { [string]$_ })

    if ($exitCode -ne 0) {
        $detail = (@($stderr) + @($stdout)) -join [Environment]::NewLine
        throw "git $($Arguments -join ' ') exited $exitCode. $detail"
    }

    # Only the success stream is returned: callers parse this with Trim() and
    # [int], and a stray progress line would corrupt the branch name or count.
    return $stdout
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
