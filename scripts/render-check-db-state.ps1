param(
  [string]$ServiceUrl = "https://chipactli.onrender.com",
  [string]$AdminToken = $env:ADMIN_TOKEN
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AdminToken)) {
  throw "Falta ADMIN_TOKEN. Define la variable de entorno ADMIN_TOKEN o pasa -AdminToken."
}

if ($AdminToken -like "TU_TOKEN*" -or $AdminToken -like "*DE_RENDER*") {
  throw "ADMIN_TOKEN parece de ejemplo. Copia el valor real desde Render > Environment."
}

$uri = "$($ServiceUrl.TrimEnd('/'))/api/backup/estado"

Write-Host "Consultando estado de DB en Render..." -ForegroundColor Cyan
try {
  $resp = Invoke-RestMethod -Method Get -Uri $uri -Headers @{ "x-admin-token" = $AdminToken }
} catch {
  $msg = $_.Exception.Message
  if ($msg -like "*No autorizado*" -or $msg -like "*401*") {
    throw "No autorizado. Verifica ADMIN_TOKEN real en Render."
  }
  throw
}

if (-not $resp.exito) {
  throw "La API respondió sin éxito al consultar /api/backup/estado"
}

Write-Host "DB_DIR efectivo: $($resp.db_dir)" -ForegroundColor Green
Write-Host "Conteos:" -ForegroundColor Yellow
$resp.conteos | ConvertTo-Json -Depth 5

Write-Host "Archivos:" -ForegroundColor Yellow
$resp.archivos | ConvertTo-Json -Depth 8
