import { transmitir } from "../utils/transmitir.js";

export function registrarRutasCategorias(app, bdRecetas) {
  app.get("/categorias", (req, res) => {
    bdRecetas.all("SELECT * FROM categorias ORDER BY nombre", (e, r) => res.json(r || []));
  });

  app.post("/categorias", (req, res) => {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: "Nombre requerido" });
    bdRecetas.run("INSERT INTO categorias (nombre) VALUES (?)", [nombre.trim()], (err) => {
      if (err) return res.status(400).json({ error: "Categoria duplicada" });
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
