const express = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

router.get('/estructura', verificarToken, verificarRol('pastor', 'secretaria'), async (req, res) => {
    try {
        const { data: departamentos, error: errorDepartamentos } = await supabase
            .from('departamentos')
            .select('id, nombre, descripcion, tipo, departamento_padre_id, orden, activo')
            .order('orden', { ascending: true })
            .order('nombre', { ascending: true });
        if (errorDepartamentos) throw errorDepartamentos;

        const { data: responsables, error: errorResponsables } = await supabase
            .from('departamento_lideres')
            .select('id, departamento_id, persona_id, cargo, orden, fecha_inicio, fecha_fin, activo, personas(nombres, apellidos, estado)')
            .order('orden', { ascending: true })
            .order('fecha_inicio', { ascending: false });
        if (errorResponsables) throw errorResponsables;

        res.json({ departamentos: departamentos || [], responsables: responsables || [] });
    } catch (err) {
        console.error('Error obteniendo estructura ministerial:', err);
        res.status(500).json({ error: 'No fue posible cargar la estructura ministerial' });
    }
});

module.exports = router;
