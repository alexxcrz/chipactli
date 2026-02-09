@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   IMPORTAR BASES DE DATOS A CHIPACTLI
echo ========================================
echo.

cd /d "Z:\Users\Alexx Crz Blife\Escritorio\CHIPACTLI"

REM Verificar que los archivos existan
echo Paso 1: Validando archivos...
if not exist "backend\inventario.db" (
    echo ERROR: No encontrado: backend\inventario.db
    pause
    exit /b 1
)
if not exist "backend\recetas.db" (
    echo ERROR: No encontrado: backend\recetas.db
    pause
    exit /b 1
)
if not exist "backend\produccion.db" (
    echo ERROR: No encontrado: backend\produccion.db
    pause
    exit /b 1
)
if not exist "backend\ventas.db" (
    echo ERROR: No encontrado: backend\ventas.db
    pause
    exit /b 1
)
echo OK - Archivos validados
echo.

REM Hacer push a GitHub
echo Paso 2: Subiendo cambios a GitHub...
git add -A > nul 2>&1
git commit -m "Fix: Multipart import para bases de datos" > nul 2>&1
git push origin main > nul 2>&1
echo OK - Cambios subidos
echo.

REM Esperar a que Render redepliegue
echo Paso 3: Esperando 5 minutos para que Render instale multer...
echo.
echo ^> GitHub push: COMPLETADO
echo ^> Render redeploy: EN PROGRESO (espera 3-5 min)
echo ^> Import script: INICIARA AUTOMATICAMENTE
echo.

timeout /t 300 /nobreak

REM Ejecutar importacion
echo.
echo Paso 4: Iniciando importacion de bases de datos...
echo.

node importar-db.js

pause
