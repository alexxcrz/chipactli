@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   IMPORTAR BASES DE DATOS
echo ========================================
echo.
echo Los cambios se estan subiendo a GitHub...
echo Render necesita 5 minutos para instalar multer.
echo.

cd /d "Z:\Users\Alexx Crz Blife\Escritorio\CHIPACTLI"

REM Contar hacia atras 5 minutos
set "segundos=300"

echo Esperando a que Render se redepliegue...
:countdown
if %segundos% lss 0 goto importar

set "minutos=!segundos! / 60"
set "segs=!segundos! %% 60"

for /f %%A in ('powershell -Command "Write-Host ([int]([int]%segundos%/60)).ToString('00') ':' ([int]([int]%segundos%%60)).ToString('00') -NoNewline"') do (
    set "timer=%%A"
)

title Espera... %timer% minutos restantes
cls
echo ========================================
echo   IMPORTAR BASES DE DATOS
echo ========================================
echo.
echo Esperando a que Render se redepliegue...
echo Tiempo restante: %timer% minutos
echo.
echo ^> GitHub push: EN PROGRESO
echo ^> Multer install: EN PROGRESO
echo ^> Import script: ESPERANDO...
echo.

set /a segundos=%segundos%-1
timeout /t 1 /nobreak > nul
goto countdown

:importar
cls
echo ========================================
echo   IMPORTAR BASES DE DATOS
echo ========================================
echo.
echo Iniciando importacion...
echo.

node importar-db.js

if errorlevel 1 (
    echo.
    echo ERROR: Fallo la importacion
    pause
    exit /b 1
) else (
    echo.
    echo EXITO! Tu aplicacion se esta reiniciando...
    pause
)
