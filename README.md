# 🌿 Chipactli

Sistema de control de insumos, recetas, producción y ventas para cosmética sólida.

## 📖 Descripción

Chipactli es una aplicación web completa para gestionar inventario, recetas, producción y ventas de productos de cosmética sólida. Incluye funcionalidades en tiempo real usando WebSockets para mantener sincronizados múltiples dispositivos.

## ✨ Características

- 📦 **Gestión de Inventario**: Control de insumos y materias primas
- 📋 **Recetas**: Creación y gestión de fórmulas de productos
- 🏭 **Producción**: Registro y seguimiento de producción
- 💰 **Ventas**: Control de ventas y cortesías
- 🔧 **Utensilios**: Gestión de herramientas y equipos
- 🔄 **Tiempo Real**: Actualizaciones automáticas vía WebSocket
- 📱 **Responsive**: Funciona en móviles, tablets y desktop

## 🚀 Despliegue en la Nube

Para desplegar esta aplicación en la nube y acceder desde cualquier lugar:

👉 **[Ver guía completa de deployment](DEPLOYMENT.md)**

### Opciones recomendadas:
- **Render.com** - Gratis, fácil, con SSL incluido
- **Railway.app** - Alternativa gratuita con buen rendimiento
- **Vercel** - Para frontend estático

## 💻 Desarrollo Local

### Requisitos
- Node.js 18 o superior
- npm o yarn

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/alexxcrz/chipactli.git
   cd chipactli
   ```

2. **Instalar dependencias**
   ```bash
   npm run install:all
   ```

3. **Iniciar en modo desarrollo**
   ```bash
   npm run dev
   ```

4. **Acceder a la aplicación**
   - Local: http://localhost:3001
   - Red local: http://TU-IP:3001

### Acceso desde otros dispositivos

Para acceder desde otro dispositivo en tu red local:
1. Ejecuta `npm run dev`
2. Busca la IP que aparece en consola
3. Abre `http://TU-IP:3001` en cualquier dispositivo conectado a la misma red

## 📁 Estructura del Proyecto

```
chipactli/
├── backend/                 # Servidor Node.js + Express
│   ├── routes/             # Rutas de la API
│   ├── utils/              # Utilidades (DB, WebSocket)
│   └── server.js           # Punto de entrada del servidor
├── frontend/               # Frontend HTML/CSS/JS
│   ├── modules/           # Módulos de funcionalidad
│   ├── utils/             # Utilidades del cliente
│   ├── images/            # Recursos gráficos
│   └── index.html         # Página principal
├── render.yaml            # Configuración para Render.com
├── DEPLOYMENT.md          # Guía de despliegue
└── package.json           # Dependencias del proyecto
```

## 🛠️ Tecnologías

### Backend
- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **SQLite** - Base de datos
- **WebSocket (ws)** - Comunicación en tiempo real
- **CORS** - Manejo de peticiones cross-origin

### Frontend
- **Vanilla JavaScript** - No frameworks, código puro
- **HTML5 / CSS3** - Estructura y estilos
- **WebSocket API** - Cliente de tiempo real
- **Fetch API** - Consumo de API REST

## 🔧 Scripts Disponibles

```bash
npm run dev              # Inicia servidor con auto-apertura
npm run dev:backend      # Solo servidor backend
npm start                # Iniciar en producción
npm run install:all      # Instalar todas las dependencias
npm run build            # Preparar para producción
```

## 📝 Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```bash
NODE_ENV=production
PORT=3001
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

ISC License

## 👤 Autor

**alexxcrz**
- GitHub: [@alexxcrz](https://github.com/alexxcrz)

---

**⭐ Si este proyecto te ayuda, considera darle una estrella en GitHub**
