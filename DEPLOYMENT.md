# 🚀 Guía de Deployment - Chipactli

Esta guía te ayudará a desplegar Chipactli en la nube para que funcione desde cualquier lugar sin necesidad de servidores locales.

## 📋 Requisitos Previos

- Cuenta en GitHub (ya la tienes ✅)
- Cuenta en [Render.com](https://render.com) (gratuita)

## 🌐 Opción 1: Render.com (Recomendado - Gratis)

Render.com ofrece hosting gratuito para aplicaciones Node.js con SSL incluido.

### Pasos:

1. **Crear cuenta en Render**
   - Visita [render.com](https://render.com)
   - Regístrate con tu cuenta de GitHub

2. **Conectar tu repositorio**
   - En el Dashboard, haz clic en "New +"
   - Selecciona "Web Service"
   - Conecta tu cuenta de GitHub
   - Busca y selecciona el repositorio `chipactli`

3. **Configurar el servicio**
   - **Name:** `chipactli` (o el nombre que prefieras)
   - **Environment:** `Node`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Selecciona "Free"

4. **Variables de entorno (opcional)**
   - `NODE_ENV` = `production`

5. **Desplegar**
   - Haz clic en "Create Web Service"
   - Render automáticamente detectará el `render.yaml` y configurará todo
   - Espera 5-10 minutos mientras se construye y despliega

6. **¡Listo!** 🎉
   - Tu aplicación estará disponible en: `https://chipactli.onrender.com`
   - Render te dará una URL única

### Actualizaciones automáticas:
Cada vez que hagas `git push` a GitHub, Render automáticamente desplegará los cambios.

---

## 🌐 Opción 2: Railway.app (Alternativa)

Railway es otra excelente opción gratuita con buen rendimiento.

### Pasos:

1. **Crear cuenta en Railway**
   - Visita [railway.app](https://railway.app)
   - Regístrate con GitHub

2. **Nuevo proyecto**
   - Click en "New Project"
   - Selecciona "Deploy from GitHub repo"
   - Selecciona `alexxcrz/chipactli`

3. **Configuración automática**
   - Railway detectará automáticamente que es una app Node.js
   - No necesitas configurar nada más

4. **Generar dominio**
   - En Settings → "Generate Domain"
   - Tu app estará en: `https://chipactli-production.up.railway.app`

---

## 🌐 Opción 3: Vercel (Solo Frontend Estático)

Si solo quieres el frontend, Vercel es una excelente opción, pero necesitarás otro servicio para el backend.

---

## 📝 Notas Importantes

### Base de datos SQLite
- Las bases de datos SQLite se crearán automáticamente en el servidor
- En el plan gratuito de Render, los datos se borran cada vez que el servicio se reinicia (después de 15 min de inactividad)
- Para datos persistentes, considera:
  - Actualizar a un plan de pago en Render
  - Usar una base de datos externa (PostgreSQL, MongoDB Atlas)

### Primer acceso
- La primera vez que alguien acceda a tu app después de inactividad, puede tardar 30-60 segundos en "despertar"
- Después de eso, funciona normalmente

### Dominio personalizado
- Puedes agregar tu propio dominio en la configuración de Render o Railway
- Render incluye SSL (HTTPS) automáticamente

---

## 🔄 Workflow de Desarrollo

1. **Desarrollo local:**
   ```bash
   npm run dev
   ```

2. **Hacer cambios y commit:**
   ```bash
   git add .
   git commit -m "descripción de cambios"
   git push origin main
   ```

3. **Deploy automático:**
   - Render/Railway detectará el push y desplegará automáticamente
   - Recibirás notificaciones del estado del deploy

---

## 🆘 Solución de Problemas

### La app no inicia
- Revisa los logs en el dashboard de Render
- Verifica que todas las dependencias estén en `package.json`

### Error de conexión WebSocket
- Asegúrate de que tu frontend esté usando la URL correcta
- El archivo `config.js` detecta automáticamente el entorno

### Datos se borran
- Es normal en el plan gratuito
- Considera usar almacenamiento persistente o plan de pago

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en Render Dashboard
2. Verifica que el repositorio en GitHub esté actualizado
3. Consulta la documentación de [Render](https://render.com/docs)

---

**¡Tu aplicación Chipactli ya puede funcionar desde cualquier lugar del mundo! 🌍**
