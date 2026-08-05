const express  = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/familias
// Lista todas las familias activas
// ============================================================
router.get('/', verificarToken, verificarRol('pastor', 'tesorero', 'oficial'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('familias')
            .select(`
                *,
                miembros (id, nombre)
            `)
            .eq('activo', true)
            .order('nombre', { ascending: true });

        if (error) throw error;

        res.json({ familias: data, total: data.length });

    } catch (err) {
        console.error('Error obteniendo familias:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// POST /api/familias
// Crea una nueva familia
// ============================================================
router.post('/', verificarToken, verificarRol('superadmin', 'pastor'), async (req, res) => {
    try {
        const { nombre } = req.body;

        if (!nombre) {
            return res.status(400).json({ error: 'El nombre de la familia es requerido' });
        }

        const { data, error } = await supabase
            .from('familias')
            .insert({ nombre })
            .select()
            .single();

        if (error) throw error;

        await supabase.from('auditoria').insert({
            usuario_id:    req.usuario.id,
            accion:        'CREAR',
            tabla:         'familias',
            registro_id:   data.id,
            datos_despues: data
        });

        res.status(201).json({ mensaje: 'Familia creada correctamente', familia: data });

    } catch (err) {
        console.error('Error creando familia:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// PUT /api/familias/:id/miembro
// Asocia o quita un miembro de una familia
// ============================================================
router.put('/:id/miembro', verificarToken, verificarRol('superadmin', 'pastor'), async (req, res) => {
    try {
        const { id }               = req.params;
        const { miembro_id, quitar } = req.body;

        if (!miembro_id) {
            return res.status(400).json({ error: 'miembro_id es requerido' });
        }

        const { data, error } = await supabase
            .from('miembros')
            .update({ familia_id: quitar ? null : id })
            .eq('id', miembro_id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            mensaje: quitar ? 'Miembro removido de la familia' : 'Miembro asociado correctamente',
            miembro: data
        });

    } catch (err) {
        console.error('Error asociando miembro:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// DELETE /api/familias/:id
// Desactiva una familia
// ============================================================
router.delete('/:id', verificarToken, verificarRol('superadmin', 'pastor'), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('familias')
            .update({ activo: false })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ mensaje: 'Familia desactivada correctamente' });

    } catch (err) {
        console.error('Error desactivando familia:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
