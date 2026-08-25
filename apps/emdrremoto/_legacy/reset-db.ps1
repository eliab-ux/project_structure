$ErrorActionPreference = "Stop"

Write-Host "Derrubando containers e removendo volumes..."
docker compose down -v | Out-Null

Write-Host "Subindo e restaurando..."
& "$PSScriptRoot\restore.ps1"
