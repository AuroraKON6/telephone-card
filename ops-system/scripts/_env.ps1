function Import-DotEnv {
  param(
    [string]$Path = ".\.env"
  )

  if (-not (Test-Path $Path)) {
    Write-Warning "Env file not found: $Path. Using current process env and defaults."
    return
  }

  Get-Content -Encoding UTF8 $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#") -or $line -notmatch "=") { return }
    $parts = $line -split "=", 2
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

function Set-MarketingProvider {
  param(
    [ValidateSet("deepseek", "mimo")]
    [string]$Provider
  )

  if ($Provider -eq "deepseek") {
    $env:MARKETING_API_PROVIDER = "deepseek"
    $env:MARKETING_MODEL_PROVIDER = "openai_compatible"
    $env:MARKETING_MODEL_BASE_URL = if ($env:DEEPSEEK_BASE_URL) { $env:DEEPSEEK_BASE_URL } else { "https://api.deepseek.com" }
    $env:MARKETING_MODEL_NAME = if ($env:DEEPSEEK_MODEL) { $env:DEEPSEEK_MODEL } else { "deepseek-v4-flash" }
    $env:MARKETING_MODEL_API_KEY = $env:DEEPSEEK_API_KEY
    $env:MARKETING_THINKING_ENABLED = if ($env:DEEPSEEK_THINKING_ENABLED) { $env:DEEPSEEK_THINKING_ENABLED } else { "true" }
    return
  }

  $env:MARKETING_API_PROVIDER = "mimo"
  $env:MARKETING_MODEL_PROVIDER = "openai_compatible"
  $env:MARKETING_MODEL_BASE_URL = if ($env:MIMO_BASE_URL) { $env:MIMO_BASE_URL } else { "https://token-plan-sgp.xiaomimimo.com/v1" }
  $env:MARKETING_MODEL_NAME = if ($env:MIMO_MODEL) { $env:MIMO_MODEL } else { "mimoV2.5pro" }
  $env:MARKETING_MODEL_API_KEY = $env:MIMO_API_KEY
  $env:MARKETING_THINKING_ENABLED = "false"
}

function Find-ClaudeCodeRoot {
  param(
    [string]$OpsRoot
  )

  if ($env:CLAUDECODE_ROOT -and (Test-Path $env:CLAUDECODE_ROOT)) {
    return (Resolve-Path $env:CLAUDECODE_ROOT).Path
  }

  $workspaceRoot = Resolve-Path (Join-Path $OpsRoot "..")
  $candidate = Get-ChildItem -Path $workspaceRoot -Directory -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq "claude-code-rev-main" -and (Test-Path (Join-Path $_.FullName "package.json")) } |
    Select-Object -First 1

  if ($candidate) {
    return $candidate.FullName
  }

  return $null
}
