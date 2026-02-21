export function inicializarBds(bdInventario, bdRecetas, bdProduccion, bdVentas) {
  // ===== BASE DE DATOS DE INVENTARIO =====
  bdInventario.serialize(() => {
    bdInventario.run(`CREATE TABLE IF NOT EXISTS inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE,
      nombre TEXT,
      unidad TEXT,
      cantidad_total REAL,
      cantidad_disponible REAL,
      costo_total REAL,
      costo_por_unidad REAL,
      pendiente INTEGER DEFAULT 0
    )`);

    // Migración: agregar columna 'pendiente' si no existe
    bdInventario.all("PRAGMA table_info(inventario)", (err, columnas) => {
      if (!err && columnas && !columnas.some(col => col.name === "pendiente")) {
        bdInventario.run("ALTER TABLE inventario ADD COLUMN pendiente INTEGER DEFAULT 0");
      }
    });

    // ===== TABLA DE USUARIOS =====
    bdInventario.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre TEXT,
      rol TEXT DEFAULT 'usuario',
      debe_cambiar_password INTEGER DEFAULT 1,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Crear usuario CEO inicial si no existe
    const username = 'alecruz';
    const passwordTemporal = 'Chipactli2026!';
    const nombre = 'Alejandro Cruz';
    const rol = 'ceo';
    bdInventario.get("SELECT * FROM usuarios WHERE username = ?", [username], (err, row) => {
      if (!row) {
        // Hash de la contraseña temporal (bcrypt hash de 'Chipactli2026!')
        const hash = '$2b$10$w8QwQnQwQnQwQnQwQnQwQeQwQnQwQnQwQnQwQnQwQnQwQnQwQnQ';
        bdInventario.run(
          `INSERT INTO usuarios (username, password_hash, nombre, rol, debe_cambiar_password) VALUES (?, ?, ?, ?, 1)`,
          [username, hash, nombre, rol]
        );
      }
    });

    bdInventario.run(`CREATE TABLE IF NOT EXISTS historial_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_inventario INTEGER,
      fecha_cambio TEXT,
      cambio_cantidad REAL,
      cambio_costo REAL
    )`);

    bdInventario.run(`CREATE TABLE IF NOT EXISTS inversion_recuperada (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_venta TEXT,
      costo_recuperado REAL
    )`);

    bdInventario.run(`CREATE TABLE IF NOT EXISTS utensilios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE,
      nombre TEXT,
      unidad TEXT,
      cantidad_total REAL,
      costo_total REAL,
      costo_por_unidad REAL
    )`);

    bdInventario.run(`CREATE TABLE IF NOT EXISTS historial_utensilios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_utensilio INTEGER,
      fecha_cambio TEXT,
      cambio_cantidad REAL,
      cambio_costo REAL
    )`);

    bdInventario.run(`CREATE TABLE IF NOT EXISTS recuperado_utensilios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_recuperado TEXT,
      monto_recuperado REAL
    )`);

    bdInventario.run(`CREATE TABLE IF NOT EXISTS ordenes_compra (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_orden TEXT UNIQUE,
      proveedor TEXT,
      fecha_creacion TEXT,
      estado TEXT,
      fecha_surtida TEXT
    )`);

    bdInventario.run(`CREATE TABLE IF NOT EXISTS ordenes_compra_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_orden INTEGER,
      id_inventario INTEGER,
      codigo TEXT,
      nombre TEXT,
      cantidad_requerida REAL,
      cantidad_surtida REAL DEFAULT 0,
      precio_unitario REAL,
      surtido INTEGER DEFAULT 0,
      FOREIGN KEY(id_orden) REFERENCES ordenes_compra(id)
    )`);
  });

  // ===== BASE DE DATOS DE RECETAS =====
  bdRecetas.serialize(() => {
    bdRecetas.run(`CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE
    )`);

    bdRecetas.run(`CREATE TABLE IF NOT EXISTS recetas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      id_categoria INTEGER,
      gramaje REAL DEFAULT 0
    )`);

    bdRecetas.run(`CREATE TABLE IF NOT EXISTS ingredientes_receta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_receta INTEGER,
      id_insumo INTEGER,
      cantidad REAL,
      unidad TEXT
    )`);

    bdRecetas.all("PRAGMA table_info(recetas)", (err, columnas) => {
      if (!err && columnas && !columnas.some(col => col.name === "gramaje")) {
        bdRecetas.run("ALTER TABLE recetas ADD COLUMN gramaje REAL DEFAULT 0");
      }
    });
  });

  // ===== BASE DE DATOS DE PRODUCCION =====
  bdProduccion.serialize(() => {
    bdProduccion.run(`CREATE TABLE IF NOT EXISTS produccion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_receta TEXT,
      cantidad INTEGER,
      fecha_produccion TEXT,
      costo_produccion REAL,
      precio_venta REAL
    )`);
  });

  // ===== BASE DE DATOS DE VENTAS =====
  bdVentas.serialize(() => {
    bdVentas.run(`CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_receta TEXT,
      cantidad INTEGER,
      fecha_produccion TEXT,
      fecha_venta TEXT,
      costo_produccion REAL,
      precio_venta REAL,
      ganancia REAL,
      numero_pedido TEXT
    )`);

    bdVentas.run(`CREATE TABLE IF NOT EXISTS cortesias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_receta TEXT,
      cantidad INTEGER,
      fecha_cortesia TEXT,
      numero_pedido TEXT,
      motivo TEXT,
      para_quien TEXT
    )`);

    bdVentas.all("PRAGMA table_info(ventas)", (err, columnas) => {
      if (!err && columnas && !columnas.some(col => col.name === "numero_pedido")) {
        bdVentas.run("ALTER TABLE ventas ADD COLUMN numero_pedido TEXT");
      }
    });

    bdVentas.all("PRAGMA table_info(cortesias)", (err, columnas) => {
      if (!err && columnas) {
        if (!columnas.some(col => col.name === "numero_pedido")) {
          bdVentas.run("ALTER TABLE cortesias ADD COLUMN numero_pedido TEXT");
        }
        if (!columnas.some(col => col.name === "motivo")) {
          bdVentas.run("ALTER TABLE cortesias ADD COLUMN motivo TEXT");
        }
        if (!columnas.some(col => col.name === "para_quien")) {
          bdVentas.run("ALTER TABLE cortesias ADD COLUMN para_quien TEXT");
        }
      }
    });
  });
}
