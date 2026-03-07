function esClientePg(db) {
  return Boolean(db && typeof db.query === "function");
}

function convertirPlaceholdersSql(sql) {
  let idx = 0;
  return String(sql || "").replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

export async function dbGet(db, sql, params = []) {
  if (esClientePg(db)) {
    const sqlPg = convertirPlaceholdersSql(sql);
    const result = await db.query(sqlPg, params);
    return result.rows?.[0] || null;
  }

  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}

export async function dbAll(db, sql, params = []) {
  if (esClientePg(db)) {
    const sqlPg = convertirPlaceholdersSql(sql);
    const result = await db.query(sqlPg, params);
    return result.rows || [];
  }

  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

export async function dbRun(db, sql, params = []) {
  if (esClientePg(db)) {
    const sqlPg = convertirPlaceholdersSql(sql);
    const result = await db.query(sqlPg, params);
    return {
      changes: Number(result.rowCount || 0),
      lastID: null
    };
  }

  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      return resolve({
        changes: Number(this?.changes || 0),
        lastID: this?.lastID ?? null
      });
    });
  });
}
