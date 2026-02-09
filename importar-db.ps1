# Script para importar bases de datos a Render (multipart upload)

$token = "chipactli-admin-2026-seguro"
$baseUrl = "https://chipactli.onrender.com"
$backendPath = "Z:\Users\Alexx Crz Blife\Escritorio\CHIPACTLI\backend"

Write-Host "=== Importacion de Bases de Datos a Chipactli ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Validando archivos..." -ForegroundColor Yellow

try {
    # Validar que existan todos los archivos
    $archivos = @(
        "inventario.db",
        "recetas.db",
        "produccion.db",
        "ventas.db"
    )
    
    foreach ($nomArchivo in $archivos) {
        $rutaArchivo = "$backendPath\$nomArchivo"
        if (-not (Test-Path $rutaArchivo)) {
            throw "Archivo no encontrado: $rutaArchivo"
        }
    }
    
    Write-Host "Archivos localizados correctamente:" -ForegroundColor Green
    Write-Host "  - inventario.db" -ForegroundColor Gray
    Write-Host "  - recetas.db" -ForegroundColor Gray
    Write-Host "  - produccion.db" -ForegroundColor Gray
    Write-Host "  - ventas.db" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Preparando carga de archivos..." -ForegroundColor Yellow
    
    # Crear multipart form data manualmente
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    $body = [System.Text.StringBuilder]::new()
    
    # Agregar cada archivo al body
    foreach ($nomArchivo in $archivos) {
        $rutaArchivo = "$backendPath\$nomArchivo"
        $nombreCampo = $nomArchivo -replace '\.db$', ''
        
        $body.Append("--$boundary$LF") | Out-Null
        $body.Append("Content-Disposition: form-data; name=`"$nombreCampo`"; filename=`"$nomArchivo`"$LF") | Out-Null
        $body.Append("Content-Type: application/octet-stream$LF$LF") | Out-Null
        
        # Leer archivo como bytes y convertir
        $fileBytes = [System.IO.File]::ReadAllBytes($rutaArchivo)
        $fileContent = [System.Text.Encoding]::Latin1.GetString($fileBytes)
        $body.Append($fileContent) | Out-Null
        $body.Append($LF) | Out-Null
    }
    
    # Cierre del boundary
    $body.Append("--$boundary--$LF") | Out-Null
    
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body.ToString())
    
    Write-Host "Enviando datos al servidor..." -ForegroundColor Yellow
    Write-Host "(Esto puede tardar 15-30 segundos)" -ForegroundColor Gray
    Write-Host ""
    
    # Crear request manualmente para mejor control
    $request = [System.Net.HttpWebRequest]::Create("$baseUrl/api/backup/importar")
    $request.Method = "POST"
    $request.ContentType = "multipart/form-data; boundary=$boundary"
    $request.Headers.Add("x-admin-token", $token)
    $request.Timeout = 120000  # 120 segundos
    $request.ContentLength = $bodyBytes.Length
    
    # Escribir body
    $stream = $request.GetRequestStream()
    $stream.Write($bodyBytes, 0, $bodyBytes.Length)
    $stream.Close()
    
    # Obtener respuesta
    $response = $request.GetResponse()
    $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
    $responseText = $reader.ReadToEnd()
    $reader.Close()
    $response.Close()
    
    $result = $responseText | ConvertFrom-Json
    
    Write-Host ""
    Write-Host "=== RESULTADO ===" -ForegroundColor Cyan
    Write-Host "Exito: $($result.exito)" -ForegroundColor $(if ($result.exito) { "Green" } else { "Red" })
    Write-Host "Mensaje: $($result.mensaje)" -ForegroundColor White
    Write-Host ""
    Write-Host "El servidor se reiniciara automaticamente con tus datos." -ForegroundColor Green
    Write-Host "Espera 1-2 minutos y accede a: $baseUrl" -ForegroundColor Cyan
    
} catch {
    Write-Host ""
    Write-Host "=== ERROR ===" -ForegroundColor Red
    
    if ($_.Exception -is [System.Net.WebException]) {
        $webException = $_.Exception
        Write-Host "Error HTTP: $($webException.Message)" -ForegroundColor Red
        
        if ($webException.Response) {
            $httpResponse = [System.Net.HttpWebResponse]$webException.Response
            
            # Intentar leer el contenido del error
            $errorStream = $httpResponse.GetResponseStream()
            $errorReader = [System.IO.StreamReader]::new($errorStream)
            $errorContent = $errorReader.ReadToEnd()
            $errorReader.Close()
            
            Write-Host "Codigo: $($httpResponse.StatusCode.value__)" -ForegroundColor Yellow
            Write-Host "Respuesta del servidor: $errorContent" -ForegroundColor Yellow
        }
    } else {
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Presiona Enter para continuar..." -ForegroundColor Gray
[System.Console]::ReadLine()
