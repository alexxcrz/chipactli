param(
  [string]$ServiceUrl = "https://chipactli.onrender.com",
  [string]$AdminToken = $env:ADMIN_TOKEN
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AdminToken)) {
  throw "Falta ADMIN_TOKEN en tu terminal."
}

$uri = "$($ServiceUrl.TrimEnd('/'))/api/backup/listar"

try {
  $resp = Invoke-RestMethod -Method Get -Uri $uri -Headers @{ "x-admin-token" = $AdminToken }
  Write-Host "TOKEN VALIDO: acceso autorizado a backup/listar" -ForegroundColor Green
  $resp | ConvertTo-Json -Depth 6
} catch {
  $msg = $_.Exception.Message
  if ($msg -like "*No autorizado*" -or $msg -like "*401*") {
    throw "TOKEN INVALIDO O NO APLICADO EN RENDER. Revisa ADMIN_TOKEN en Render + redeploy."
  }
  throw
}
