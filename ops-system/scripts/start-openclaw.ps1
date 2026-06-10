param(
  [string]$EnvFile = ".\.env",
  [string]$Config = ".\openclaw\openclaw.yaml",
  [ValidateSet("", "deepseek", "mimo")]
  [string]$Provider = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_env.ps1"
Import-DotEnv -Path $EnvFile

if ($Provider) {
  Set-MarketingProvider -Provider $Provider
}

New-Item -ItemType Directory -Force -Path ".\logs" | Out-Null

Write-Host "Runtime: OpenClaw"
Write-Host "Config: $Config"
Write-Host "Marketing API: $($env:MARKETING_API_PROVIDER) / $($env:MARKETING_MODEL_NAME)"

if ($DryRun) {
  Write-Host "DryRun: not starting."
  Write-Host "Command: openclaw run --config $Config"
  exit 0
}

if (-not (Get-Command openclaw -ErrorAction SilentlyContinue)) {
  Write-Error "openclaw CLI was not found. Install OpenClaw first or update this script to match your CLI."
}

openclaw run --config $Config
