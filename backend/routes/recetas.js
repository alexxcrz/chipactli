import { transmitir } from "../utils/transmitir.js";
import { convertirCantidad } from "../utils/convertir-cantidad.js";

export function registrarRutasRecetas(app, bdRecetas, bdInventario) {
  app.get("/recetas", (req, res) => {
    const idCategoria = req.query.categoria || "";
    const sql = `SELECT r.*, c.nombre as categoria FROM recetas r LEFT JOIN categorias c ON r.id_categoria = c.id ${idCategoria ? "WHERE r.id_categoria = ?" : ""} ORDER BY r.nombre`;
    bdRecetas.all(sql, idCategoria ? [idCategoria] : [], (e, r) => res.json(r || []));
  });

  app.get("/recetas/:id", (req, res) => {
    const id = req.params.id;
    bdRecetas.get("SELECT * FROM recetas WHERE id=?", [id], (e, receta) => {
      if (!receta) return res.status(404).json({ error: "No encontrada" });
      bdRecetas.all(
        `SELECT ir.id, ir.id_insumo, ir.cantidad, ir.unidad
         FROM ingredientes_receta ir
         WHERE ir.id_receta=?`,
        [id],
        (err, ingredientes) => {
          if (!ingredientes || ingredientes.length === 0) {
            receta.ingredientes = [];
            return res.json(receta);
          }
          
          // Obtener nombres de insumos desde la otra BD
          let pendientes = ingredientes.length;
          ingredientes.forEach(ing => {
            bdInventario.get(
              "SELECT nombre FROM inventario WHERE id=?",
              [ing.id_insumo],
              (errInv, insumo) => {
                ing.nombre = insumo ? insumo.nombre : "Desconocido";
                pendientes--;
                if (pendientes === 0) {
                  receta.ingredientes = ingredientes;
                  res.json(receta);
                }
              }
            );
          });
        }
      );
    });
  });

  app.post("/recetas", (req, res) => {
    const { nombre, id_categoria, gramaje, ingredientes } = req.body;
    if (!nombre || !id_categoria) return res.status(400).json({ error: "Datos incompletos" });

    bdRecetas.run(
      "INSERT INTO recetas (nombre, id_categoria, gramaje) VALUES (?,?,?)",
      [nombre, id_categoria, gramaje || 0],
      function () {
        const idReceta = this.lastID;
        const lista = Array.isArray(ingredientes) ? ingredientes : [];
        if (lista.length === 0) {
          transmitir({ tipo: "recetas_actualizado" });
          return res.json({ ok: true, id: idReceta });
        }

        let pendientes = lista.length;
        lista.forEach(ing => {
          bdRecetas.run(
            "INSERT INTO ingredientes_receta (id_receta, id_insumo, cantidad, unidad) VALUES (?,?,?,?)",
            [idReceta, ing.id_insumo, ing.cantidad, ing.unidad],
            () => {
              pendientes--;
              if (pendientes === 0) {
                transmitir({ tipo: "recetas_actualizado" });
                res.json({ ok: true, id: idReceta });
              }
            }
          );
        });
      }
    );
  });

  app.patch("/recetas/:id", (req, res) => {
    const id = req.params.id;
    const { nombre, id_categoria, gramaje, ingredientes } = req.body;

    bdRecetas.run(
      "UPDATE recetas SET nombre=?, id_categoria=?, gramaje=? WHERE id=?",
      [nombre, id_categoria, gramaje || 0, id],
      () => {
        bdRecetas.run("DELETE FROM ingredientes_receta WHERE id_receta=?", [id], () => {
          const lista = Array.isArray(ingredientes) ? ingredientes : [];
          if (lista.length === 0) {
            transmitir({ tipo: "recetas_actualizado" });
            return res.json({ ok: true });
          }

          let pendientes = lista.length;
          lista.forEach(ing => {
            bdRecetas.run(
              "INSERT INTO ingredientes_receta (id_receta, id_insumo, cantidad, unidad) VALUES (?,?,?,?)",
              [id, ing.id_insumo, ing.cantidad, ing.unidad],
              () => {
                pendientes--;
                if (pendientes === 0) {
                  transmitir({ tipo: "recetas_actualizado" });
                  res.json({ ok: true });
                }
              }
            );
          });
        });
      }
    );
  });

  app.delete("/recetas/:id", (req, res) => {
    const id = req.params.id;
    bdRecetas.run("DELETE FROM ingredientes_receta WHERE id_receta=?", [id], () => {
      bdRecetas.run("DELETE FROM recetas WHERE id=?", [id], () => {
        transmitir({ tipo: "recetas_actualizado" });
        res.json({ ok: true });
      });
    });
  });

  app.post("/recetas/calcular", (req, res) => {
    const { id_receta } = req.body;
    bdRecetas.all(
      "SELECT * FROM ingredientes_receta WHERE id_receta=?",
      [id_receta],
      (err, ingredientes) => {
        if (!ingredientes || ingredientes.length === 0) return res.json({ piezas_maximas: 0, costo_por_pieza: 0 });

        let piezasMaximas = null;
        let costoPorPieza = 0;
        let pendientes = ingredientes.length;

        ingredientes.forEach(ing => {
          bdInventario.get("SELECT * FROM inventario WHERE id=?", [ing.id_insumo], (errInv, insumo) => {
            if (insumo) {
              const requerido = convertirCantidad(Number(ing.cantidad) || 0, ing.unidad, insumo.unidad);
              if (requerido > 0) {
                const disponibles = Number(insumo.cantidad_disponible) || 0;
                const maxPorIngrediente = Math.floor(disponibles / requerido);
                piezasMaximas = piezasMaximas === null ? maxPorIngrediente : Math.min(piezasMaximas, maxPorIngrediente);
                costoPorPieza += (Number(insumo.costo_por_unidad) || 0) * requerido;
              }
            }
            pendientes--;
            if (pendientes === 0) {
              res.json({
                piezas_maximas: piezasMaximas === null ? 0 : piezasMaximas,
                costo_por_pieza: costoPorPieza
              });
            }
          });
        });
      }
    );
  });
}
