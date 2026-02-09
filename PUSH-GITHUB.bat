@echo off
chcp 65001 > nul
cd /d "Z:\Users\Alexx Crz Blife\Escritorio\CHIPACTLI"

echo.
echo ========================================
echo   SUBIR CAMBIOS A GITHUB
echo ========================================
echo.

git add -A
git commit -m "Add: Sistema de descarga de datos y endpoints de backup"
git push origin main

if errorlevel 1 (
    echo.
    echo ERROR al hacer push
    pause
) else (
    echo.
    echo EXITO! Cambios subidos a GitHub
    echo Render redepliegara en 3-5 minutos
    pause
)
