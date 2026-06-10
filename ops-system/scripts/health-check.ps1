param(
  [string]$EnvFile = ".\.env"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_env.ps1"
Import-DotEnv -Path $EnvFile

Write-Host "Checking local customer model..."
$body = @{
  model = $env:CUSTOMER_MODEL_NAME
  messages = @(@{ role = "user"; content = "Reply in one short sentence: local customer service is OK." })
  temperature = 0.2
} | ConvertTo-Json -Depth 6

Invoke-RestMethod `
  -Uri "$($env:CUSTOMER_MODEL_BASE_URL)/chat/completions" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $($env:CUSTOMER_MODEL_API_KEY)" } `
  -ContentType "application/json" `
  -Body $body | ConvertTo-Json -Depth 8

Write-Host "Checking marketing model config..."
if ([string]::IsNullOrWhiteSpace($env:MARKETING_MODEL_BASE_URL) -or [string]::IsNullOrWhiteSpace($env:MARKETING_MODEL_API_KEY)) {
  Write-Warning "Marketing API is not configured yet. Local customer model can still run."
} else {
  Write-Host "Marketing endpoint configured: $($env:MARKETING_MODEL_BASE_URL)"
}
