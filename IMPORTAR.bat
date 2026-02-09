@echo off
chcp 65001 > nul
cd /d "Z:\Users\Alexx Crz Blife\Escritorio\CHIPACTLI"

cls
echo.
echo ========================================
echo   IMPORTAR BASES DE DATOS CHIPACTLI
echo ========================================
echo.
echo Este proceso:
echo   1. Hace push a GitHub
echo   2. Espera 5 min para que Render redepliegue
echo   3. Importa tus 4 bases de datos
echo.
echo Duracion total: ~6 minutos
echo.
timeout /t 3 /nobreak

cls
node importar-completo.js

if errorlevel 1 (
    echo.
    echo Presiona Enter para cerrar...
    pause
)
