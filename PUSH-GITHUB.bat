@echo off
chcp 65001 > nul
cd /d "Z:\Users\Alexx Crz Blife\Escritorio\CHIPACTLI"

echo.
echo ========================================
echo   SUBIR CAMBIOS A GITHUB
echo ========================================
echo.

git add -A
set /p COMMIT_MSG="Escribe el comentario para el commit: "
git commit -m "%COMMIT_MSG%"
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
