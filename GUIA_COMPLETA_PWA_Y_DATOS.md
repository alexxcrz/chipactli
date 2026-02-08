# 📱 Guía Completa: App Instalable + Base de Datos Persistente

## 🗄️ PARTE 1: Persistencia de Base de Datos

### ✅ ¿Qué se ha configurado?

Tu aplicación ahora tiene **dos sistemas de protección de datos**:

#### 1. Disco Persistente en Render
- Las bases de datos SQLite se guardan en un disco que NO se borra
- Capacidad: 1 GB gratis
- Tus datos permanecen aunque el servidor se reinicie

#### 2. Sistema de Backups Automáticos
- **Frecuencia**: Cada 6 horas
- **Qué respalda**: Todas las bases de datos (inventario, recetas, producción, ventas)
- **Retención**: Últimos 5 backups
- **Automático**: Se activa solo en producción

### 🔧 Cómo Usar los Backups

Una vez desplegada tu app, tendrás acceso a estas funcionalidades:

#### Crear Backup Manual
```javascript
// Desde la consola del navegador (F12):
fetch('/api/backup/crear', { method: 'POST' })
  .then(r => r.json())
  .then(data => console.log(data));
```

#### Listar Backups Disponibles
```javascript
fetch('/api/backup/listar')
  .then(r => r.json())
  .then(data => console.log(data));
```

#### Restaurar un Backup
```javascript
fetch('/api/backup/restaurar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ timestamp: 'TU_TIMESTAMP_AQUI' })
})
.then(r => r.json())
.then(data => console.log(data));
```

### 📝 Notas Importantes sobre los Datos

- ✅ Con el disco persistente, tus datos **NO se borran**
- ✅ Los backups son una capa extra de seguridad
- ✅ Puedes restaurar cualquiera de los últimos 5 backups
- ⚠️ El plan gratuito de Render tiene 1GB (suficiente para bases de datos SQLite)
- 💡 Si necesitas más espacio, puedes actualizar a un plan de pago

---

## 📱 PARTE 2: App Instalable (PWA)

### ✅ ¿Qué es una PWA?

Una **Progressive Web App** permite que tu aplicación web se instale y funcione como una app nativa en:
- 📱 Android
- 🍎 iOS (iPhone/iPad)
- 💻 Windows
- 🖥️ Mac
- 🐧 Linux

### 🎯 Características de tu PWA

✅ **Instalable**: Se instala como una app normal
✅ **Sin stores**: No necesitas publicar en Google Play o App Store
✅ **Funciona offline**: Cache de archivos para uso sin conexión
✅ **Icono en pantalla**: Aparece con el resto de tus apps
✅ **Pantalla completa**: Se ve como app nativa (sin barra del navegador)
✅ **Actualizaciones automáticas**: Sin descargar del store

### 📲 Cómo Instalar (Para Usuarios)

#### En Android (Chrome):
1. Abre tu app en Chrome
2. Verás un botón **"📱 Instalar App"** abajo a la derecha
3. O ve al menú (⋮) → "Agregar a pantalla de inicio"
4. Acepta la instalación
5. ¡Listo! Aparecerá en tus apps

#### En iOS (Safari):
1. Abre tu app en Safari
2. Toca el botón de compartir (📤)
3. Selecciona "Agregar a pantalla de inicio"
4. Confirma
5. ¡Listo! Aparecerá en tu pantalla de inicio

#### En PC (Chrome/Edge):
1. Abre tu app
2. Ve al menú → "Instalar Chipactli"
3. O haz click en el icono ⊕ en la barra de direcciones
4. Confirma
5. Se abrirá en una ventana separada

### 🎨 Configurar los Iconos de la App

Para que tu app se vea profesional, necesitas crear los iconos:

👉 **Ver guía completa**: [frontend/images/GUIA_ICONOS_PWA.md](frontend/images/GUIA_ICONOS_PWA.md)

**Opción Rápida** (para probar):
```powershell
# En la carpeta frontend/images/:
Copy-Item logo.PNG icon-72x72.png
Copy-Item logo.PNG icon-96x96.png
Copy-Item logo.PNG icon-128x128.png
Copy-Item logo.PNG icon-144x144.png
Copy-Item logo.PNG icon-152x152.png
Copy-Item logo.PNG icon-192x192.png
Copy-Item logo.PNG icon-384x384.png
Copy-Item logo.PNG icon-512x512.png
```

---

## 🚀 PARTE 3: Desplegar Todo

### Paso a Paso:

1. **Subir cambios a GitHub**
   ```bash
   git add .
   git commit -m "Agregar PWA y sistema de backups"
   git push origin main
   ```

2. **Render detectará automáticamente los cambios**
   - Reconstruirá la app con el disco persistente
   - Activará el sistema de backups

3. **Verificar que funciona**
   - Abre tu app desplegada
   - Abre la consola (F12)
   - Deberías ver: "📦 Sistema de backups automáticos activado"
   - Deberías ver: "✅ Service Worker registrado"

4. **Instalar la app**
   - Busca el botón "📱 Instalar App"
   - O usa el menú del navegador

---

## 🔍 Verificar que Todo Funciona

### Verificar Backups:
```javascript
// En la consola del navegador (F12):
fetch('/api/backup/listar')
  .then(r => r.json())
  .then(data => console.log('Backups:', data));
```

### Verificar PWA:
1. Abre DevTools (F12)
2. Ve a "Application" → "Manifest"
3. Deberías ver "Chipactli - Control de Insumos"
4. Ve a "Service Workers"
5. Deberías ver "sw.js" activado

### Verificar Disco Persistente:
- En el Dashboard de Render → Tu servicio → "Disks"
- Deberías ver "chipactli-data" con 1GB

---

## 🆘 Solución de Problemas

### Los datos se siguen borrando:
- Verifica que el disco esté montado en Render Dashboard
- El disco puede tardar unos minutos en configurarse la primera vez

### La app no se puede instalar:
- Verifica que estés usando HTTPS (Render lo incluye automáticamente)
- Crea los iconos PWA (ver guía de iconos)
- Abre la consola para ver errores

### Los backups no se crean:
- Solo se activan en producción (NODE_ENV=production)
- Verifica los logs en Render Dashboard
- Espera al menos 1 minuto después del deploy

### Service Worker no se registra:
- Verifica que sw.js esté accesible: `tuapp.com/sw.js`
- Limpia la caché del navegador (Ctrl+Shift+Delete)
- Los Service Workers solo funcionan en HTTPS o localhost

---

## 📊 Ventajas de esta Configuración

| Característica | Antes | Ahora |
|----------------|-------|-------|
| **Acceso** | Solo local | Desde cualquier lugar |
| **Datos** | Se borran al reiniciar | Persisten + Backups |
| **Instalación** | N/A | Como app nativa |
| **Offline** | No funciona | Cache básico |
| **Actualizaciones** | Manual | Automáticas con git push |
| **SSL/HTTPS** | No | Incluido gratis |
| **Multiplataforma** | Solo PC | Android, iOS, PC, todo |

---

## 🎉 ¡Listo!

Ahora tu aplicación Chipactli:
- ✅ Funciona desde cualquier lugar
- ✅ Se puede instalar como app
- ✅ Los datos no se pierden
- ✅ Tiene backups automáticos
- ✅ Actualización automática con cada commit

**¿Siguiente paso?** 
1. Sube todo a GitHub
2. Despliega en Render
3. Crea los iconos PWA
4. ¡Empieza a usar tu app!

---

**Documentación adicional:**
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Guía de despliegue
- [README.md](../README.md) - Documentación del proyecto
- [GUIA_ICONOS_PWA.md](frontend/images/GUIA_ICONOS_PWA.md) - Crear iconos
