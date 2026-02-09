@echo off
echo ========================================
echo   Subiendo cambios a GitHub
echo ========================================
echo.

cd /d "Z:\Users\Alexx Crz Blife\Escritorio\CHIPACTLI"

echo Estado del repositorio:
git status
echo.

echo Confirmando cambios...
git add -A
git commit -m "Fix: Usar multipart/form-data en lugar de JSON Base64 para importar DB (fix 413 error)"

if errorlevel 1 (
    echo No hay cambios nuevos que confirmar
) else (
    echo.
    echo Subiendo a GitHub...
    git push origin main
    if errorlevel 1 (
        echo ERROR al hacer push
    ) else (
        echo EXITO! Los cambios se subieron correctamente
    )
)

echo.
echo Presiona Enter para continuar...
pause
