import { transmitir } from "../../utils/index.js";

export function registrarRutasCategorias(app, bdRecetas) {
  app.get("/categorias", (req, res) => {
    bdRecetas.all("SELECT id, nombre, image_url FROM categorias ORDER BY nombre", (e, r) => res.json(r || []));
  });

  app.post("/categorias", (req, res) => {
    const { nombre } = req.body;
    const imageUrl = String(req.body?.image_url || '').trim();
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: "Nombre requerido" });
    bdRecetas.run("INSERT INTO categorias (nombre, image_url) VALUES (?, ?)", [nombre.trim(), imageUrl], (err) => {
      if (err) return res.status(400).json({ error: "Categoria duplicada" });
      transmitir({ tipo: "categorias_actualizado" });
      res.json({ ok: true });
    });
  });

  app.patch("/categorias/:id", (req, res) => {
    const id = req.params.id;
    const nombre = (req.body?.nombre || '').trim();
    const imageUrl = typeof req.body?.image_url === 'string' ? String(req.body.image_url || '').trim() : undefined;
    if (!nombre) return res.status(400).json({ error: "Nombre requerido" });

    const sql = imageUrl !== undefined
      ? "UPDATE categorias SET nombre = ?, image_url = ? WHERE id = ?"
      : "UPDATE categorias SET nombre = ? WHERE id = ?";
    const params = imageUrl !== undefined ? [nombre, imageUrl, id] : [nombre, id];

    bdRecetas.run(sql, params, function (err) {
      if (err) return res.status(400).json({ error: "No se pudo actualizar categoría" });
      if (!this.changes) return res.status(404).json({ error: "Categoría no encontrada" });
      transmitir({ tipo: "categorias_actualizado" });
      res.json({ ok: true });
    });
  });

  app.delete("/categorias/:id", (req, res) => {
    const id = req.params.id;
    
    // Verificar si la categoría tiene recetas asociadas
    bdRecetas.get("SELECT COUNT(*) as total FROM recetas WHERE id_categoria = ?", [id], (err, row) => {
      if (err) return res.status(500).json({ error: "Error verificando recetas" });
      
      if (row.total > 0) {
        return res.status(400).json({ error: "No se puede eliminar. La categoría tiene recetas asociadas." });
      }
      
      // Si no tiene recetas, eliminar
      bdRecetas.run("DELETE FROM categorias WHERE id = ?", [id], (errDel) => {
        if (errDel) return res.status(500).json({ error: "Error al eliminar categoría" });
        transmitir({ tipo: "categorias_actualizado" });
        res.json({ ok: true });
      });
    });
  });
}
