$ErrorActionPreference = "Stop"

Write-Host "Subindo containers..."
docker compose up -d | Out-Null

$container = "emdr_mariadb"
$maxAttempts = 60
$attempt = 0
$delaySeconds = 2

Write-Host "Aguardando MariaDB ficar saud?vel..."
while ($attempt -lt $maxAttempts) {
  $status = docker inspect --format '{{.State.Health.Status}}' $container 2>$null
  if (-not $status) {
    $status = "unknown"
  }
  Write-Host "Healthcheck: $status"
  if ($status -eq "healthy") {
    break
  }
  Start-Sleep -Seconds $delaySeconds
  $attempt++
}

if ($status -ne "healthy") {
  throw "MariaDB n?o ficou saud?vel ap?s $($maxAttempts * $delaySeconds) segundos."
}

Write-Host "Validando dump dentro do container..."
docker exec $container sh -lc "test -f /backup/dump.sql"

Write-Host "Restaurando dump no banco emdr..."
docker exec -i $container sh -lc "mariadb -u emdr -pemdr emdr < /backup/dump.sql"

if ($LASTEXITCODE -ne 0) {
  throw "Falha ao restaurar o dump."
}

Write-Host "Restore conclu?do."
Write-Host ""
Write-Host "Acesso Adminer: http://localhost:8080"
Write-Host "Servidor: emdr_mariadb"
Write-Host "Banco: emdr"
Write-Host "Usu?rio: emdr"
Write-Host "Senha: emdr"
Write-Host ""
Write-Host "Conex?o direta (localhost):"
Write-Host "Host: 127.0.0.1"
Write-Host "Porta: 3306"
Write-Host "Banco: emdr"
Write-Host "Usu?rio: emdr"
Write-Host "Senha: emdr"
