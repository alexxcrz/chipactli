import { Client } from "pg";

function convertirPlaceholdersSql(sql) {
  let idx = 0;
  return String(sql || "").replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

function normalizarArgs(paramsOrCb, maybeCb) {
  if (typeof paramsOrCb === "function") {
    return { params: [], cb: paramsOrCb };
  }
  return { params: Array.isArray(paramsOrCb) ? paramsOrCb : [], cb: maybeCb };
}

function extraerTablaInsert(sql) {
  const match = String(sql || "").match(/^\s*INSERT\s+INTO\s+([\w."']+)/i);
  return match?.[1] || null;
}

async function ejecutarRun(client, sql, params) {
  const sqlTrim = String(sql || "").trim().replace(/;\s*$/, "");
  const sqlPg = convertirPlaceholdersSql(sqlTrim);
  const esInsert = /^\s*INSERT\s+INTO\s+/i.test(sqlTrim);

  if (!esInsert) {
    const result = await client.query(sqlPg, params);
    return { changes: Number(result.rowCount || 0), lastID: null };
  }

  try {
    const result = await client.query(`${sqlPg} RETURNING id`, params);
    const lastID = result.rows?.[0]?.id ?? null;
    return { changes: Number(result.rowCount || 0), lastID };
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    if (!msg.includes("column") || !msg.includes("id")) {
      throw error;
    }
    const result = await client.query(sqlPg, params);
    return { changes: Number(result.rowCount || 0), lastID: null };
  }
}

function qIdent(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

async function asegurarAutoincrementoIds(client, schema) {
  const schemaSafe = String(schema || "public");
  const colRows = await client.query(
    `SELECT table_name, column_default, data_type
     FROM information_schema.columns
     WHERE table_schema = $1
       AND column_name = 'id'
       AND data_type IN ('integer', 'bigint')`,
    [schemaSafe]
  );

  for (const row of colRows.rows || []) {
    const tableName = String(row?.table_name || "").trim();
    if (!tableName) continue;

    const defaultVal = String(row?.column_default || "").toLowerCase();
    if (defaultVal.includes("nextval(")) continue;

    const seqName = `${tableName}_id_seq`;
    const tableRef = `${qIdent(schemaSafe)}.${qIdent(tableName)}`;
    const seqRef = `${qIdent(schemaSafe)}.${qIdent(seqName)}`;
    const seqTextRef = `${schemaSafe.replaceAll("'", "''")}.${seqName.replaceAll("'", "''")}`;

    await client.query(`CREATE SEQUENCE IF NOT EXISTS ${seqRef}`);
    await client.query(`ALTER TABLE ${tableRef} ALTER COLUMN id SET DEFAULT nextval('${seqTextRef}')`);
    await client.query(`SELECT setval('${seqTextRef}', COALESCE((SELECT MAX(id) FROM ${tableRef}), 0), true)`);
  }
}

function crearInterfazSqlite(client) {
  return {
    _esPgCompat: true,
    _pgClient: client,

    get(sql, paramsOrCb, maybeCb) {
      const { params, cb } = normalizarArgs(paramsOrCb, maybeCb);
      client.query(convertirPlaceholdersSql(sql), params)
        .then((result) => cb?.(null, result.rows?.[0] || null))
        .catch((error) => cb?.(error));
    },

    all(sql, paramsOrCb, maybeCb) {
      const { params, cb } = normalizarArgs(paramsOrCb, maybeCb);
      client.query(convertirPlaceholdersSql(sql), params)
        .then((result) => cb?.(null, result.rows || []))
        .catch((error) => cb?.(error));
    },

    run(sql, paramsOrCb, maybeCb) {
      const { params, cb } = normalizarArgs(paramsOrCb, maybeCb);
      ejecutarRun(client, sql, params)
        .then((meta) => {
          const ctx = { changes: meta.changes || 0, lastID: meta.lastID ?? 0 };
          cb?.call(ctx, null);
        })
        .catch((error) => cb?.call({ changes: 0, lastID: 0 }, error));
    }
  };
}

export async function crearPgSqliteCompat({
  databaseUrl,
  schema,
  useSsl = true
}) {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });

  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${String(schema || "public").replaceAll('"', '""')}"`);
  await client.query(`SET search_path TO "${String(schema || "public").replaceAll('"', '""')}", public`);
  await asegurarAutoincrementoIds(client, String(schema || "public"));

  return {
    db: crearInterfazSqlite(client),
    close: async () => {
      await client.end();
    }
  };
}
