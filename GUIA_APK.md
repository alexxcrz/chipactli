# 📦 Instrucciones para Generar APK de Chipactli  

## ✅ Requisitos Previos
- ✅ Android Studio instalado  
- ✅ Android SDK configurado (`C:\Users\Alexx Crz Blife\AppData\Local\Android\Sdk`)  
- ✅ JDK 17 (incluido en Android Studio: `C:\Program Files\Android\Android Studio\jbr`)  
- ✅ Node.js y npm instalados  
- ✅ Bubblewrap CLI instalado (`npm install -g @bubblewrap/cli`)  

---

## 🚀 Paso a Paso

### 1. Configurar Variables de Entorno

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

### 2. Crear Carpeta del Proyecto APK

```powershell
cd "Z:\Users\Alexx Crz Blife\Escritorio"
mkdir chipactli-apk
cd chipactli-apk
```

### 3. Inicializar Proyecto TWA

```powershell
bubblewrap init --manifest "https://chipactli.onrender.com/manifest.json"
```

**Si el manifest no funciona**, usa el archivo local:
```powershell
bubblewrap init --manifest "Z:\Users\Alexx Crz Blife\Escritorio\CHIPACTLI\twa-manifest.json"
```

#### Respuestas del Wizard:

- **Install JDK?** → `No` (ya tienes JDK 17)
- **JDK Path?** → `C:\Program Files\Android\Android Studio\jbr`
- **Android SDK Path?** → `C:\Users\Alexx Crz Blife\AppData\Local\Android\Sdk`
- **Application Name?** → `Chipactli insumos` (ya configurado)
- **Package Name?** → `com.alexxcrz.chipactli` (ya configurado)
- **Everything else** → Presiona Enter (usa valores predeterminados)

### 4. Construir APK Debug

```powershell
bubblew rap build
```

Esto tomará 3-5 minutos.

### 5. Ubicar el APK

El APK estará en:
```
chipactli-apk\app-release-signed.apk
```

O:
```
chipactli-apk\app\build\outputs\apk\release\app-release.apk
```

### 6. Transferir al Teléfono

**Opción A: USB**
```powershell
# Habilita "Transferencia de archivos" en tu Android
Copy-Item app-release-signed.apk D:\
```

**Opción B: ADB (si está instalado)**
```powershell
adb install app-release-signed.apk
```

**Opción C: Subir a Google Drive/Dropbox**
- Sube el APK a la nube
- Descárgalo desde tu Android
- Instálalo desde "Archivos"

---

## ⚠️ Solución de Problemas

### Error: JDK no encontrado
```powershell
# Verifica la ruta exacta:
Get-ChildItem "C:\Program Files\Android\Android Studio\jbr\bin\java.exe"

# Si no existe, busca el JDK:
Get-ChildItem "C:\Program Files\Android\Android Studio" -Recurse -Filter java.exe | Select-Object -First 1
```

### Error: SDK no encontrado
```powershell
# Verifica:
$env:ANDROID_HOME
Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\build-tools"
```

### Error: Gradle build failed
```powershell
# Limpia y reconstruye:
cd chipactli-apk
Remove-Item -Recurse -Force app\build
bubblewrap build
```

### Error: Signing key
```powershell
# Genera clave de firma:
cd chipactli-apk
bubblewrap update --appVersion 1 --appVersionCode 1
bubblewrap build
```

---

## 🔐 APK Release (Firmado)

Si quieres distribuir el APK:

1. **Genera Keystore:**
```powershell
keytool -genkey -v -keystore chipactli-key.keystore -alias chipactli -keyalg RSA -keysize 2048 -validity 10000
```

2. **Actualiza twa-manifest.json:**
```json
{
  "signing": {
    "keystore": "chipactli-key.keystore",
    "alias": "chipactli"
  }
}
```

3. **Reconstruye:**
```powershell
bubblewrap build
```

---

## 📱 Instalar en Android

1. **Habilita instalación de fuentes desconocidas:**
   - Ajustes → Seguridad → Instalar apps desconocidas → Activa para "Archivos" o "Chrome"

2. **Instala el APK:**
   - Abre el APK desde Archivos
   - Acepta los permisos
   - ¡Listo!

---

## 📊 Comparación PWA vs APK

| Característica | PWA | APK |
|----------------|-----|-----|
| Instalación | Desde navegador | Archivo APK |
| Tamaño | ~2 MB | ~10 MB |
| Actualizaciones | Automáticas | Manual |
| App Store | No requiere | No requiere (Debug) |
| Permisos | Limitados | Completos |
| Icono | Sí | Sí |

---

**Si encuentras errores, envía el log completo para ayudarte.**
