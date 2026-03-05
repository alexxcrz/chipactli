param(
  [string]$ServiceUrl = "https://chipactli.onrender.com",
  [string]$AdminToken = $env:ADMIN_TOKEN,
  [string]$ProjectRoot = "c:\Users\alexx\Desktop\CHIPACTLI 2.0"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AdminToken)) {
  throw "Falta ADMIN_TOKEN. Define la variable de entorno ADMIN_TOKEN o pasa -AdminToken."
}

if ($AdminToken -like "TU_TOKEN*" -or $AdminToken -like "*DE_RENDER*") {
  throw "ADMIN_TOKEN parece de ejemplo. Copia el valor real desde Render > Environment."
}

function Copy-DbToTempUnlocked {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  $inStream = $null
  $outStream = $null
  try {
    $inStream = [System.IO.File]::Open($Source, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $outStream = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $inStream.CopyTo($outStream)
  } finally {
    if ($outStream) { $outStream.Dispose() }
    if ($inStream) { $inStream.Dispose() }
  }
}

$backendDir = Join-Path $ProjectRoot "backend"
$dbFiles = @{
  inventario = Join-Path $backendDir "inventario.db"
  recetas    = Join-Path $backendDir "recetas.db"
  produccion = Join-Path $backendDir "produccion.db"
  ventas     = Join-Path $backendDir "ventas.db"
  admin      = Join-Path $backendDir "admin.db"
}

foreach ($k in $dbFiles.Keys) {
  if (-not (Test-Path $dbFiles[$k])) {
    throw "No existe DB requerida: $($dbFiles[$k])"
  }
}

# Consolidar WAL en los archivos .db para evitar subir snapshots incompletos.
Push-Location $backendDir
try {
  node .\scripts\checkpoint-dbs.mjs $backendDir | Write-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo al ejecutar checkpoint WAL en las bases locales."
  }
} finally {
  Pop-Location
}

$uri = "$($ServiceUrl.TrimEnd('/'))/api/backup/importar"

Write-Host "Subiendo DBs a Render..." -ForegroundColor Cyan

$form = @{}
$tempDir = Join-Path $env:TEMP ("chipactli-render-upload-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
  foreach ($k in $dbFiles.Keys) {
    $source = $dbFiles[$k]
    $tempFile = Join-Path $tempDir ("$k.db")
    Copy-DbToTempUnlocked -Source $source -Destination $tempFile
    $form[$k] = Get-Item $tempFile
  }

  $response = Invoke-RestMethod -Method Post -Uri $uri -Headers @{ "x-admin-token" = $AdminToken } -Form $form

  Write-Host "Respuesta API:" -ForegroundColor Green
  $response | ConvertTo-Json -Depth 8

  if ($response.exito -ne $true) {
    throw "La API respondió sin éxito."
  }

  Write-Host "Importación enviada correctamente. El servicio puede reiniciar en 5-20 segundos." -ForegroundColor Yellow
} catch {
  $msg = $_.Exception.Message
  if ($msg -like "*No autorizado*" -or $msg -like "*401*") {
    throw "No autorizado en Render. Verifica ADMIN_TOKEN real en tu terminal y en variables de entorno del servicio."
  }
  throw
} finally {
  if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
