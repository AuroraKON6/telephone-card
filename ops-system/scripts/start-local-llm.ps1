param(
  [string]$ModelName = "qwen3.5-9b-local"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Error "ollama was not found. Install Ollama and import the Qwen 3.5 9B quantized model first."
}

Write-Host "Checking Ollama models..."
ollama list

Write-Host "Checking Ollama service at http://127.0.0.1:11434"
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get -TimeoutSec 2 | Out-Null
  Write-Host "Ollama service is running."
} catch {
  Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

Write-Host "Local customer model target: $ModelName"
Write-Host "If missing, run: ollama create $ModelName -f .\models\Modelfile"
