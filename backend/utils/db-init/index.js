import bcrypt from "bcrypt";
import { serializarPermisos } from "../permisos/index.js";

export function inicializarBds(bdInventario, bdRecetas, bdProduccion, bdVentas) {
  // ===== BASE DE DATOS DE INVENTARIO =====
  bdInventario.serialize(() => {
    bdInventario.run(`CREATE TABLE IF NOT EXISTS inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE,
      nombre TEXT,
      proveedor TEXT,
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
      if (!err && columnas && !columnas.some(col => col.name === "proveedor")) {
        bdInventario.run("ALTER TABLE inventario ADD COLUMN proveedor TEXT");
      }
    });

    bdInventario.run(`CREATE TABLE IF NOT EXISTS historial_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_inventario INTEGER,
      fecha_cambio TEXT,
      cambio_cantidad REAL,
      cambio_costo REAL
    )`);

    bdInventario.run(`CREATE TABLE IF NOT EXISTS insumos_eliminados (
      id_inventario INTEGER PRIMARY KEY,
      codigo TEXT,
      nombre TEXT,
      unidad TEXT,
      eliminado_en TEXT
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
      proveedor TEXT,
      unidad TEXT,
      cantidad_total REAL,
      costo_total REAL,
      costo_por_unidad REAL
    )`);

    bdInventario.all("PRAGMA table_info(utensilios)", (err, columnas) => {
      if (!err && columnas && !columnas.some(col => col.name === "proveedor")) {
        bdInventario.run("ALTER TABLE utensilios ADD COLUMN proveedor TEXT");
      }
    });

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
      tipo_item TEXT DEFAULT 'insumo',
      id_inventario INTEGER,
      id_utensilio INTEGER,
      codigo TEXT,
      nombre TEXT,
      cantidad_requerida REAL,
      cantidad_surtida REAL DEFAULT 0,
      precio_unitario REAL,
      costo_total_surtido REAL DEFAULT 0,
      surtido INTEGER DEFAULT 0,
      FOREIGN KEY(id_orden) REFERENCES ordenes_compra(id)
    )`);

    bdInventario.all("PRAGMA table_info(ordenes_compra_items)", (err, columnas) => {
      if (err || !Array.isArray(columnas)) return;
      if (!columnas.some(col => col.name === "tipo_item")) {
        bdInventario.run("ALTER TABLE ordenes_compra_items ADD COLUMN tipo_item TEXT DEFAULT 'insumo'");
      }
      if (!columnas.some(col => col.name === "id_utensilio")) {
        bdInventario.run("ALTER TABLE ordenes_compra_items ADD COLUMN id_utensilio INTEGER");
      }
      if (!columnas.some(col => col.name === "costo_total_surtido")) {
        bdInventario.run("ALTER TABLE ordenes_compra_items ADD COLUMN costo_total_surtido REAL DEFAULT 0");
      }
    });

    bdInventario.run(`CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE,
      direccion TEXT,
      telefono TEXT,
      forma_pago TEXT,
      numero_cuenta TEXT,
      correo TEXT,
      notas TEXT,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdInventario.all('PRAGMA table_info(proveedores)', (err, columnas) => {
      if (err || !Array.isArray(columnas)) return;
      if (!columnas.some((col) => col.name === 'forma_pago')) {
        bdInventario.run("ALTER TABLE proveedores ADD COLUMN forma_pago TEXT DEFAULT ''", () => {
          bdInventario.run(
            `UPDATE proveedores
             SET forma_pago = CASE
               WHEN LOWER(TRIM(COALESCE(numero_cuenta, ''))) IN ('transferencia', 'tarjeta', 'efectivo', 'tarjeta/efectivo', 'interna')
                 THEN TRIM(numero_cuenta)
               ELSE ''
             END
             WHERE TRIM(COALESCE(forma_pago, '')) = ''`
          );
        });
      }
    });

    bdInventario.run(`CREATE TABLE IF NOT EXISTS lista_precios_ordenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_item TEXT DEFAULT 'insumo',
      id_referencia INTEGER,
      codigo TEXT,
      nombre TEXT,
      proveedor TEXT,
      unidad TEXT,
      cantidad_referencia REAL,
      precio_unitario REAL,
      costo_total_referencia REAL,
      vigente_desde TEXT,
      vigente_hasta TEXT,
      ultima_compra_en TEXT,
      activo INTEGER DEFAULT 1,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdInventario.run(`CREATE TABLE IF NOT EXISTS historial_lista_precios_ordenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_lista_precio INTEGER,
      precio_unitario REAL,
      costo_total_referencia REAL,
      vigente_desde TEXT,
      vigente_hasta TEXT,
      motivo TEXT,
      registrado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdInventario.run(`CREATE INDEX IF NOT EXISTS idx_lista_precios_ordenes_activo
      ON lista_precios_ordenes (activo, tipo_item, id_referencia, codigo, nombre, unidad, cantidad_referencia)`);

    bdInventario.run(`CREATE INDEX IF NOT EXISTS idx_historial_lista_precios_ordenes_lista
      ON historial_lista_precios_ordenes (id_lista_precio, vigente_desde)`);

    bdInventario.run(`CREATE TABLE IF NOT EXISTS lista_precios_archivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      proveedor TEXT,
      url TEXT,
      tipo TEXT,
      contenido_texto TEXT,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdInventario.all('PRAGMA table_info(lista_precios_archivos)', (err, columnas) => {
      if (err || !Array.isArray(columnas)) return;
      if (!columnas.some((col) => col.name === 'proveedor')) {
        bdInventario.run('ALTER TABLE lista_precios_archivos ADD COLUMN proveedor TEXT');
      }
      if (!columnas.some((col) => col.name === 'contenido_texto')) {
        bdInventario.run('ALTER TABLE lista_precios_archivos ADD COLUMN contenido_texto TEXT');
      }
    });

    bdInventario.run(`CREATE INDEX IF NOT EXISTS idx_lista_precios_archivos_creado
      ON lista_precios_archivos (creado_en DESC)`);
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
      gramaje REAL DEFAULT 0,
      archivada INTEGER DEFAULT 0,
      tienda_descripcion TEXT,
      tienda_modo_uso TEXT,
      tienda_cuidados TEXT,
      tienda_ingredientes TEXT,
      tienda_precio_publico REAL DEFAULT 0,
      tienda_image_url TEXT,
      tienda_galeria TEXT
    )`);

    bdRecetas.run(`CREATE TABLE IF NOT EXISTS ingredientes_receta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_receta INTEGER,
      id_insumo INTEGER,
      nombre_insumo TEXT,
      proveedor TEXT,
      cantidad REAL,
      unidad TEXT
    )`);

    bdRecetas.all("PRAGMA table_info(recetas)", (err, columnas) => {
      if (!err && columnas && !columnas.some(col => col.name === "gramaje")) {
        bdRecetas.run("ALTER TABLE recetas ADD COLUMN gramaje REAL DEFAULT 0");
      }
      if (!err && columnas && !columnas.some(col => col.name === "archivada")) {
        bdRecetas.run("ALTER TABLE recetas ADD COLUMN archivada INTEGER DEFAULT 0");
      }
      if (!err && columnas && !columnas.some(col => col.name === "tienda_descripcion")) {
        bdRecetas.run("ALTER TABLE recetas ADD COLUMN tienda_descripcion TEXT");
      }
      if (!err && columnas && !columnas.some(col => col.name === "tienda_modo_uso")) {
        bdRecetas.run("ALTER TABLE recetas ADD COLUMN tienda_modo_uso TEXT");
      }
      if (!err && columnas && !columnas.some(col => col.name === "tienda_cuidados")) {
        bdRecetas.run("ALTER TABLE recetas ADD COLUMN tienda_cuidados TEXT");
      }
      if (!err && columnas && !columnas.some(col => col.name === "tienda_ingredientes")) {
        bdRecetas.run("ALTER TABLE recetas ADD COLUMN tienda_ingredientes TEXT");
      }
      if (!err && columnas && !columnas.some(col => col.name === "tienda_precio_publico")) {
        bdRecetas.run("ALTER TABLE recetas ADD COLUMN tienda_precio_publico REAL DEFAULT 0");
      }
      if (!err && columnas && !columnas.some(col => col.name === "tienda_image_url")) {
        bdRecetas.run("ALTER TABLE recetas ADD COLUMN tienda_image_url TEXT");
      }
      if (!err && columnas && !columnas.some(col => col.name === "tienda_galeria")) {
        bdRecetas.run("ALTER TABLE recetas ADD COLUMN tienda_galeria TEXT");
      }
    });

    bdRecetas.all("PRAGMA table_info(ingredientes_receta)", (err, columnas) => {
      if (!err && columnas && !columnas.some(col => col.name === "nombre_insumo")) {
        bdRecetas.run("ALTER TABLE ingredientes_receta ADD COLUMN nombre_insumo TEXT");
      }
      if (!err && columnas && !columnas.some(col => col.name === "proveedor")) {
        bdRecetas.run("ALTER TABLE ingredientes_receta ADD COLUMN proveedor TEXT");
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

    bdProduccion.run(`CREATE TABLE IF NOT EXISTS produccion_descuentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_produccion INTEGER,
      id_insumo INTEGER,
      cantidad_descuento REAL,
      unidad_insumo TEXT,
      costo_por_unidad REAL,
      fecha_descuento TEXT,
      FOREIGN KEY(id_produccion) REFERENCES produccion(id)
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

    bdVentas.run(`CREATE TABLE IF NOT EXISTS tienda_catalogo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receta_nombre TEXT UNIQUE,
      slug TEXT UNIQUE,
      descripcion TEXT,
      image_url TEXT,
      ingredientes TEXT,
      variantes TEXT,
      es_lanzamiento INTEGER DEFAULT 0,
      es_favorito INTEGER DEFAULT 0,
      es_oferta INTEGER DEFAULT 0,
      es_accesorio INTEGER DEFAULT 0,
      activo INTEGER DEFAULT 1,
      actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdVentas.run(`CREATE TABLE IF NOT EXISTS tienda_clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      telefono TEXT,
      direccion_default TEXT,
      forma_pago_preferida TEXT,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdVentas.run(`CREATE TABLE IF NOT EXISTS tienda_ordenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE,
      id_cliente INTEGER,
      nombre_cliente TEXT,
      email_cliente TEXT,
      telefono_cliente TEXT,
      metodo_pago TEXT,
      estado TEXT,
      total REAL,
      moneda TEXT DEFAULT 'MXN',
      referencia_externa TEXT,
      detalle_pago TEXT,
      id_punto_entrega INTEGER,
      nombre_punto_entrega TEXT,
      direccion_entrega TEXT,
      notas TEXT,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdVentas.run(`CREATE TABLE IF NOT EXISTS tienda_puntos_entrega (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE,
      direccion TEXT,
      horario TEXT,
      activo INTEGER DEFAULT 1,
      archivo_url TEXT,
      archivo_nombre TEXT,
      archivo_tipo TEXT,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdVentas.all("PRAGMA table_info(tienda_puntos_entrega)", (err, columnas) => {
      if (err || !Array.isArray(columnas)) return;
      if (!columnas.some((col) => col.name === "archivo_url")) {
        bdVentas.run("ALTER TABLE tienda_puntos_entrega ADD COLUMN archivo_url TEXT");
      }
      if (!columnas.some((col) => col.name === "archivo_nombre")) {
        bdVentas.run("ALTER TABLE tienda_puntos_entrega ADD COLUMN archivo_nombre TEXT");
      }
      if (!columnas.some((col) => col.name === "archivo_tipo")) {
        bdVentas.run("ALTER TABLE tienda_puntos_entrega ADD COLUMN archivo_tipo TEXT");
      }
    });

    bdVentas.run(`CREATE TABLE IF NOT EXISTS tienda_orden_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_orden INTEGER,
      receta_nombre TEXT,
      cantidad INTEGER,
      precio_unitario REAL,
      subtotal REAL,
      variante TEXT,
      FOREIGN KEY(id_orden) REFERENCES tienda_ordenes(id)
    )`);

    bdVentas.run(`CREATE TABLE IF NOT EXISTS tienda_resenas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receta_nombre TEXT,
      id_cliente INTEGER,
      nombre_cliente TEXT,
      calificacion INTEGER,
      comentario TEXT,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdVentas.run(`CREATE TABLE IF NOT EXISTS tienda_config (
      clave TEXT PRIMARY KEY,
      valor TEXT,
      actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
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

    bdVentas.all("PRAGMA table_info(tienda_catalogo)", (err, columnas) => {
      if (err || !Array.isArray(columnas)) return;
      if (!columnas.some(col => col.name === "descripcion")) {
        bdVentas.run("ALTER TABLE tienda_catalogo ADD COLUMN descripcion TEXT");
      }
      if (!columnas.some(col => col.name === "image_url")) {
        bdVentas.run("ALTER TABLE tienda_catalogo ADD COLUMN image_url TEXT");
      }
      if (!columnas.some(col => col.name === "ingredientes")) {
        bdVentas.run("ALTER TABLE tienda_catalogo ADD COLUMN ingredientes TEXT");
      }
      if (!columnas.some(col => col.name === "variantes")) {
        bdVentas.run("ALTER TABLE tienda_catalogo ADD COLUMN variantes TEXT");
      }
      if (!columnas.some(col => col.name === "es_lanzamiento")) {
        bdVentas.run("ALTER TABLE tienda_catalogo ADD COLUMN es_lanzamiento INTEGER DEFAULT 0");
      }
      if (!columnas.some(col => col.name === "es_favorito")) {
        bdVentas.run("ALTER TABLE tienda_catalogo ADD COLUMN es_favorito INTEGER DEFAULT 0");
      }
      if (!columnas.some(col => col.name === "es_oferta")) {
        bdVentas.run("ALTER TABLE tienda_catalogo ADD COLUMN es_oferta INTEGER DEFAULT 0");
      }
      if (!columnas.some(col => col.name === "es_accesorio")) {
        bdVentas.run("ALTER TABLE tienda_catalogo ADD COLUMN es_accesorio INTEGER DEFAULT 0");
      }
      if (!columnas.some(col => col.name === "activo")) {
        bdVentas.run("ALTER TABLE tienda_catalogo ADD COLUMN activo INTEGER DEFAULT 1");
      }
      if (!columnas.some(col => col.name === "actualizado_en")) {
        bdVentas.run("ALTER TABLE tienda_catalogo ADD COLUMN actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP");
      }
      bdVentas.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_tienda_catalogo_slug ON tienda_catalogo(slug)");
    });

    bdVentas.all("PRAGMA table_info(tienda_ordenes)", (err, columnas) => {
      if (err || !Array.isArray(columnas)) return;
      if (!columnas.some(col => col.name === "id_punto_entrega")) {
        bdVentas.run("ALTER TABLE tienda_ordenes ADD COLUMN id_punto_entrega INTEGER");
      }
      if (!columnas.some(col => col.name === "nombre_punto_entrega")) {
        bdVentas.run("ALTER TABLE tienda_ordenes ADD COLUMN nombre_punto_entrega TEXT");
      }
    });
  });
}

export function inicializarBdAdmin(bdAdmin, bdInventario) {
  bdAdmin.serialize(() => {
    bdAdmin.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre TEXT,
      rol TEXT DEFAULT 'usuario',
      permisos TEXT,
      debe_cambiar_password INTEGER DEFAULT 1,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdAdmin.run(`CREATE TABLE IF NOT EXISTS auditoria_admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accion TEXT NOT NULL,
      detalle TEXT,
      usuario TEXT,
      fecha TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    bdAdmin.all("PRAGMA table_info(usuarios)", (errCols, cols) => {
      if (errCols || !Array.isArray(cols)) return;

      const continuar = () => {
        bdAdmin.run(
          "UPDATE usuarios SET permisos = ? WHERE (permisos IS NULL OR permisos = '') AND rol = 'ceo'",
          [serializarPermisos(null, 'ceo')]
        );
        bdAdmin.run(
          "UPDATE usuarios SET permisos = ? WHERE (permisos IS NULL OR permisos = '') AND rol = 'admin'",
          [serializarPermisos(null, 'admin')]
        );
        bdAdmin.run(
          "UPDATE usuarios SET permisos = ? WHERE (permisos IS NULL OR permisos = '') AND (rol IS NULL OR rol = '' OR rol = 'usuario')",
          [serializarPermisos(null, 'usuario')]
        );

        bdAdmin.get("SELECT COUNT(*) AS total FROM usuarios", [], (countErr, row) => {
          if (countErr || !row) return;
          if (row.total > 0) return;

          bdInventario.all(
            "SELECT username, password_hash, nombre, rol, debe_cambiar_password, creado_en, actualizado_en FROM usuarios",
            [],
            (legacyErr, legacyUsers) => {
              if (!legacyErr && legacyUsers && legacyUsers.length > 0) {
                const insertSql = `INSERT INTO usuarios (username, password_hash, nombre, rol, permisos, debe_cambiar_password, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                for (const user of legacyUsers) {
                  bdAdmin.run(insertSql, [
                    user.username,
                    user.password_hash,
                    user.nombre || '',
                    user.rol || 'usuario',
                    serializarPermisos(null, user.rol || 'usuario'),
                    user.debe_cambiar_password ? 1 : 0,
                    user.creado_en || new Date().toISOString(),
                    user.actualizado_en || new Date().toISOString()
                  ]);
                }
                return;
              }

              const username = String(process.env.MASTER_USERNAME || 'maestro').trim().toLowerCase();
              const passwordTemporal = String(process.env.MASTER_PASSWORD || 'ChipactliMaster2026!');
              const nombre = String(process.env.MASTER_NOMBRE || 'Usuario Maestro').trim() || 'Usuario Maestro';
              const rol = 'maestro';
              bcrypt.hash(passwordTemporal, 10, (hashErr, hash) => {
                if (hashErr) return;
                bdAdmin.run(
                  `INSERT INTO usuarios (username, password_hash, nombre, rol, permisos, debe_cambiar_password) VALUES (?, ?, ?, ?, ?, 0)`,
                  [username, hash, nombre, rol, serializarPermisos(null, 'usuario')]
                );
              });
            }
          );
        });
      };

      if (!cols.some(col => col.name === "permisos")) {
        bdAdmin.run("ALTER TABLE usuarios ADD COLUMN permisos TEXT", [], () => continuar());
        return;
      }

      continuar();
    });
  });
}
