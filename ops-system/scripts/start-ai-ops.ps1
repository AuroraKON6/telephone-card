param(
  [string]$EnvFile = ".\.env",
  [ValidateSet("", "1", "2")]
  [string]$RuntimeChoice = "",
  [ValidateSet("", "1", "2")]
  [string]$ApiChoice = "",
  [switch]$SkipLocalModelCheck,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_env.ps1"
Import-DotEnv -Path $EnvFile

Write-Host ""
Write-Host "Select runtime:"
Write-Host "1. OpenClaw"
Write-Host "2. ClaudeCode"
$runtime = if ($RuntimeChoice) { $RuntimeChoice } else { Read-Host "Input 1 or 2" }

if ($runtime -ne "1" -and $runtime -ne "2") {
  Write-Error "Invalid runtime selection: $runtime. Input 1 or 2."
}

Write-Host ""
Write-Host "Select marketing API:"
Write-Host "1. DeepSeek V4 Flash"
Write-Host "2. Mimo V2.5 Pro"
$api = if ($ApiChoice) { $ApiChoice } else { Read-Host "Input 1 or 2" }

switch ($api) {
  "1" { $provider = "deepseek" }
  "2" { $provider = "mimo" }
  default { Write-Error "Invalid API selection: $api. Input 1 or 2." }
}

Set-MarketingProvider -Provider $provider

if (-not $SkipLocalModelCheck -and -not $DryRun) {
  Write-Host ""
  Write-Host "Checking local customer model..."
  & "$PSScriptRoot\start-local-llm.ps1"
}

if ($runtime -eq "1") {
  Write-Host ""
  Write-Host "Selected: OpenClaw + $($env:MARKETING_API_PROVIDER)"
  & "$PSScriptRoot\start-openclaw.ps1" -EnvFile $EnvFile -Provider $provider -DryRun:$DryRun
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Selected: ClaudeCode + $($env:MARKETING_API_PROVIDER)"
& "$PSScriptRoot\start-claudecode.ps1" -EnvFile $EnvFile -Provider $provider -DryRun:$DryRun
