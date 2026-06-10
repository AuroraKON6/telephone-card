param(
  [string]$EnvFile = ".\.env",
  [ValidateSet("deepseek", "mimo")]
  [string]$Provider = "deepseek",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_env.ps1"
Import-DotEnv -Path $EnvFile
Set-MarketingProvider -Provider $Provider

$opsRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$claudeRoot = Find-ClaudeCodeRoot -OpsRoot $opsRoot

if (-not $claudeRoot) {
  Write-Error "ClaudeCode root not found. Set CLAUDECODE_ROOT in .env."
}

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Error "bun was not found. ClaudeCode requires Bun 1.3.5+."
}

$settingsOut = if ($env:CLAUDECODE_SETTINGS_OUT) {
  Join-Path $opsRoot $env:CLAUDECODE_SETTINGS_OUT
} else {
  Join-Path $opsRoot "claudecode\settings.selected.json"
}

$settingsDir = Split-Path $settingsOut -Parent
New-Item -ItemType Directory -Force -Path $settingsDir | Out-Null

$providerName = if ($Provider -eq "deepseek") { "DeepSeek V4 Flash" } else { "Mimo V2.5 Pro" }
$apiKeyEnv = if ($Provider -eq "deepseek") { "DEEPSEEK_API_KEY" } else { "MIMO_API_KEY" }

$settings = [ordered]@{
  provider = $Provider
  model = $env:MARKETING_MODEL_NAME
  providers = @{
    $Provider = [ordered]@{
      type = "openai-compatible"
      name = $providerName
      baseURL = $env:MARKETING_MODEL_BASE_URL
      apiKeyEnv = $apiKeyEnv
      defaultModel = $env:MARKETING_MODEL_NAME
      models = @($env:MARKETING_MODEL_NAME)
    }
  }
  env = @{
    CUSTOMER_MODEL_BASE_URL = $env:CUSTOMER_MODEL_BASE_URL
    CUSTOMER_MODEL_NAME = $env:CUSTOMER_MODEL_NAME
    CUSTOMER_MODEL_API_KEY = $env:CUSTOMER_MODEL_API_KEY
    API_172_ENABLED = $env:API_172_ENABLED
    MARKETING_THINKING_ENABLED = $env:MARKETING_THINKING_ENABLED
  }
  permissions = @{
    defaultMode = "default"
  }
}

$settingsJson = $settings | ConvertTo-Json -Depth 10 -Compress
$settingsJson | Set-Content -Path $settingsOut -Encoding UTF8

$promptFile = if ($env:CLAUDECODE_SYSTEM_PROMPT) {
  Join-Path $opsRoot $env:CLAUDECODE_SYSTEM_PROMPT
} else {
  Join-Path $opsRoot "claudecode\CLAUDECODE_SYSTEM_PROMPT.md"
}

Write-Host ""
Write-Host "Runtime: ClaudeCode"
Write-Host "Marketing API: $providerName"
Write-Host "ClaudeCode root: $claudeRoot"
Write-Host "Settings file: $settingsOut"
Write-Host "Customer local model: $($env:CUSTOMER_MODEL_BASE_URL) / $($env:CUSTOMER_MODEL_NAME)"
Write-Host "Thinking mode: $($env:MARKETING_THINKING_ENABLED)"

if ([string]::IsNullOrWhiteSpace($env:MARKETING_MODEL_API_KEY)) {
  Write-Warning "$apiKeyEnv is empty. Fill it in .env before real marketing API calls."
}

Write-Host ""
Write-Host "Starting ClaudeCode..."
$thinkingArgs = @()
if ($Provider -eq "deepseek" -and $env:MARKETING_THINKING_ENABLED -eq "true") {
  $thinkingArgs = @("--thinking", "enabled")
}

if ($DryRun) {
  Write-Host "DryRun: not starting."
  $thinkingText = if ($thinkingArgs.Count -gt 0) { " --thinking enabled" } else { "" }
  Write-Host "Command: bun run --cwd `"$claudeRoot`" dev --settings <settings-json> --model $($env:MARKETING_MODEL_NAME)$thinkingText --add-dir `"$opsRoot`" --append-system-prompt-file `"$promptFile`""
  exit 0
}

$cmdArgs = @(
  "run",
  "--cwd",
  $claudeRoot,
  "dev",
  "--settings",
  $settingsJson,
  "--model",
  $env:MARKETING_MODEL_NAME
) + $thinkingArgs + @(
  "--add-dir",
  $opsRoot,
  "--append-system-prompt-file",
  $promptFile
)

& bun @cmdArgs
