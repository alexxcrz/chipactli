param(
  [string]$ServiceUrl = "https://chipactli.onrender.com",
  [string]$AdminToken = $env:ADMIN_TOKEN,
  [string]$OutFile = "$env:TEMP\chipactli-admin-render.db"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AdminToken)) {
  throw "Falta ADMIN_TOKEN. Define la variable de entorno ADMIN_TOKEN o pasa -AdminToken."
}

if ($AdminToken -like "TU_TOKEN*" -or $AdminToken -like "*DE_RENDER*") {
  throw "ADMIN_TOKEN parece de ejemplo. Copia el valor real desde Render > Environment."
}

$downloadUrl = "$($ServiceUrl.TrimEnd('/'))/api/backup/descargar/admin"

Write-Host "Descargando admin.db desde Render..." -ForegroundColor Cyan
try {
  Invoke-WebRequest -Method Get -Uri $downloadUrl -Headers @{ "x-admin-token" = $AdminToken } -OutFile $OutFile
} catch {
  $msg = $_.Exception.Message
  if ($msg -like "*No autorizado*" -or $msg -like "*401*") {
    throw "No autorizado en Render. Verifica ADMIN_TOKEN real y vuelve a intentar."
  }
  throw
}

if (-not (Test-Path $OutFile)) {
  throw "No se pudo descargar admin.db"
}

$size = (Get-Item $OutFile).Length
Write-Host "admin.db descargado: $OutFile ($size bytes)" -ForegroundColor Green

if ($size -lt 1024) {
  Write-Warning "El archivo admin.db parece muy pequeño. Revisa que la importación se haya completado."
}

Write-Host "Verificación básica completada." -ForegroundColor Yellow
