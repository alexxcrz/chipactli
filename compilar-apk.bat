@echo off
echo ========================================
echo   COMPILADOR DE APK - CHIPACTLI
echo ========================================
echo.

REM Configurar variables de entorno
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

echo Configurando entorno...
echo JAVA_HOME: %JAVA_HOME%
echo ANDROID_HOME: %ANDROID_HOME%
echo.

REM Crear carpeta del proyecto
cd /d "Z:\Users\Alexx Crz Blife\Escritorio"
if not exist "chipactli-apk" mkdir chipactli-apk
cd chipactli-apk

echo Carpeta de trabajo: %CD%
echo.

echo ========================================
echo PASO 1: Inicializar proyecto TWA
echo ========================================
echo.
echo Se abrira un wizard interactivo.
echo RESPONDE así:
echo.
echo   Install JDK? → No
echo   JDK Path → C:\Program Files\Android\Android Studio\jbr
echo   SDK Path → %LOCALAPPDATA%\Android\Sdk
echo   Los demas → Presiona Enter (ya estan configurados)
echo.
pause

call bubblewrap init --manifest "Z:\Users\Alexx Crz Blife\Escritorio\CHIPACTLI\twa-manifest.json"

if errorlevel 1 (
    echo.
    echo ERROR: Fallo la inicializacion
    pause
    exit /b 1
)

echo.
echo ========================================
echo PASO 2: Compilar APK
echo ========================================
echo.
echo Esto tomara 3-5 minutos...
echo.

call bubblewrap build

if errorlevel 1 (
    echo.
    echo ERROR: Fallo la compilacion
    pause
    exit /b 1
)

echo.
echo ========================================
echo   COMPILACION EXITOSA!
echo ========================================
echo.
echo APK ubicado en una de estas rutas:
echo   - app-release-signed.apk
echo   - app\build\outputs\apk\release\app-release.apk
echo.
echo Transfierelo a tu Android y disfruta!
echo.
pause
