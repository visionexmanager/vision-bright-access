[CmdletBinding()]
param(
    [ValidateRange(5, 1440)]
    [int]$EveryMinutes = 5
)

$ErrorActionPreference = "Stop"
$syncScript = Join-Path $PSScriptRoot "sync-visionex.ps1"
$taskName = "Visionex Git Sync"

if (-not (Test-Path -LiteralPath $syncScript)) {
    throw "Sync script not found: $syncScript"
}

$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$syncScript`""
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Safely fetch Visionex and fast-forward a clean local main branch." `
    -Force | Out-Null

Write-Output "Installed '$taskName'. Visionex will check GitHub every $EveryMinutes minute(s)."
Write-Output "Local changes and feature branches are always preserved."
