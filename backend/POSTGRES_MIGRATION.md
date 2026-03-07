# Migracion a PostgreSQL (Fase 1)

Este proyecto hoy funciona con SQLite en tiempo real. Este documento agrega una migracion segura de datos a PostgreSQL para trabajar en paralelo y preparar el cambio por modulos.

## 1) Requisitos

- PostgreSQL disponible (Render Postgres, Neon, Supabase, etc.).
- `DATABASE_URL` configurada.
- Bases SQLite actuales accesibles (`inventario.db`, `recetas.db`, `produccion.db`, `ventas.db`, `admin.db`).

## 2) Variables de entorno

En `backend/.env` (o en tu entorno de ejecucion):

```env
DATABASE_URL=postgres://USUARIO:PASS@HOST:5432/DB
SQLITE_DB_DIR=C:\ruta\a\backend
PG_SCHEMA_PREFIX=chipactli
```

Notas:
- `SQLITE_DB_DIR` debe apuntar a la carpeta donde estan los `.db`.
- Si no defines `SQLITE_DB_DIR`, el script usa `DB_DIR`, o `backend/` por defecto.
- El script crea esquemas por base: `chipactli_inventario`, `chipactli_recetas`, etc.

## 3) Instalar dependencias

```bash
npm --prefix backend install
```

## 4) Ejecutar migracion

```bash
npm --prefix backend run migrate:sqlite-to-pg
```

El script:
- Crea esquemas por cada SQLite (`inventario`, `recetas`, `produccion`, `ventas`, `admin`).
- Crea tablas en PostgreSQL con tipos equivalentes.
- Copia todas las filas de SQLite a PostgreSQL.

## 5) Verificacion rapida

Conecta a Postgres y revisa conteos por esquema/tabla.

Ejemplo:
```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema LIKE 'chipactli_%'
ORDER BY table_schema, table_name;
```

## 6) Importante sobre Fase 2

Esta fase migra datos, pero el backend sigue leyendo SQLite.
La Fase 2 es migrar rutas/modulos para consultar PostgreSQL en runtime.

## 7) Auth/Admin en PostgreSQL (ya disponible)

Se agrego soporte para que login y administracion de usuarios usen PostgreSQL sin tocar otros modulos.

Variables:

```env
PG_ADMIN_AUTH=1
DATABASE_URL=postgres://USUARIO:PASS@HOST:5432/DB
PG_SSL=1
PG_SCHEMA_PREFIX=chipactli
# opcional: PG_ADMIN_SCHEMA=chipactli_admin
```

Comportamiento:
- Si `PG_ADMIN_AUTH=1` y conecta a PostgreSQL, `auth` y `/api/privado/usuarios` usan Postgres.
- Si falla la conexion, el sistema cae en fallback a SQLite automaticamente.

## 8) Inventario/Utensilios en PostgreSQL (ya disponible)

Se agrego soporte para que rutas de inventario y utensilios funcionen en PostgreSQL sin reescribir cada endpoint.

Variables:

```env
PG_INVENTARIO=1
DATABASE_URL=postgres://USUARIO:PASS@HOST:5432/DB
PG_SSL=1
PG_SCHEMA_PREFIX=chipactli
# opcional: PG_INVENTARIO_SCHEMA=chipactli_inventario
```

Comportamiento:
- Si `PG_INVENTARIO=1` y conecta a PostgreSQL, `/inventario*` y `/utensilios*` usan Postgres.
- Si falla la conexion, el sistema cae en fallback a SQLite automaticamente.

## 9) Recetas en PostgreSQL (ya disponible)

Se agrego soporte para que recetas y modulos dependientes usen PostgreSQL con un solo switch.

Variables:

```env
PG_RECETAS=1
DATABASE_URL=postgres://USUARIO:PASS@HOST:5432/DB
PG_SSL=1
PG_SCHEMA_PREFIX=chipactli
# opcional: PG_RECETAS_SCHEMA=chipactli_recetas
```

Comportamiento:
- Si `PG_RECETAS=1` y conecta a PostgreSQL, rutas de `recetas` usan Postgres.
- Para consistencia entre modulos, el servidor inyecta esa misma conexion en categorias/produccion/ventas/tienda para lecturas de recetas.
- Si falla la conexion, el sistema cae en fallback a SQLite automaticamente.

## 10) Produccion en PostgreSQL (ya disponible)

Variables:

```env
PG_PRODUCCION=1
DATABASE_URL=postgres://USUARIO:PASS@HOST:5432/DB
PG_SSL=1
PG_SCHEMA_PREFIX=chipactli
# opcional: PG_PRODUCCION_SCHEMA=chipactli_produccion
```

Comportamiento:
- Si `PG_PRODUCCION=1` y conecta a PostgreSQL, rutas de `produccion` usan Postgres.
- Si falla la conexion, cae en fallback a SQLite automaticamente.

## 11) Ventas/Tienda en PostgreSQL (ya disponible)

Variables:

```env
PG_VENTAS=1
DATABASE_URL=postgres://USUARIO:PASS@HOST:5432/DB
PG_SSL=1
PG_SCHEMA_PREFIX=chipactli
# opcional: PG_VENTAS_SCHEMA=chipactli_ventas
```

Comportamiento:
- Si `PG_VENTAS=1` y conecta a PostgreSQL, rutas de `ventas`, `cortesias` y `tienda` usan Postgres.
- Si falla la conexion, cae en fallback a SQLite automaticamente.

Orden sugerido:
1. `admin` (auth/usuarios)
2. `inventario`
3. `recetas`
4. `produccion`
5. `ventas` y `tienda`

Con ese orden no se rompe produccion mientras se valida cada modulo.
