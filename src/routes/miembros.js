const express  = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { esRutValido, formatearRut } = require('../utils/rut');

const router = express.Router();

router.get('/', verificarToken, verificarRol('pastor', 'tesorero', 'oficial'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('miembros')
            .select('*')
            .order('nombre', { ascending: true });
        if (error) throw error;
        const rolesLimitados = new Set(['oficial', 'tesorero']);
        const rolesUsuario = new Set([
            req.usuario.rol,
            ...(Array.isArray(req.usuario.roles) ? req.usuario.roles : [])
        ].filter(Boolean));
        const tieneDirectorioLimitado = !rolesUsuario.has('superadmin')
            && !rolesUsuario.has('pastor')
            && [...rolesLimitados].some(rol => rolesUsuario.has(rol));
        const miembros = tieneDirectorioLimitado
            ? data.map(miembro => ({
                id: miembro.id,
                nombre: miembro.nombre,
                familia_id: miembro.familia_id,
                fecha_ingreso: miembro.fecha_ingreso,
                activo: miembro.activo
            }))
            : data;
        res.json({ miembros, total: miembros.length });
    } catch (err) {
        console.error('Error obteniendo miembros:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/:id', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('miembros').select('*').eq('id', id).single();
        if (error || !data) return res.status(404).json({ error: 'Miembro no encontrado' });
        res.json({ miembro: data });
    } catch (err) {
        console.error('Error obteniendo miembro:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        const {
            nombre,
            rut,
            correo,
            telefono,
            fecha_bautismo,
            direccion,
            fecha_ingreso,
            activo
        } = req.body;

        if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

        if (!esRutValido(rut)) {
            return res.status(400).json({ error: 'Ingresa un RUT chileno válido' });
        }

        const { data, error } = await supabase.rpc('crear_miembro_con_persona', {
            p_nombre: nombre.trim(),
            p_rut: formatearRut(rut),
            p_correo: correo || null,
            p_telefono: telefono || null,
            p_fecha_bautismo: fecha_bautismo || null,
            p_direccion: direccion || null,
            p_fecha_ingreso: fecha_ingreso || new Date().toISOString().split('T')[0],
            p_activo: activo !== false,
            p_actor_id: req.usuario.id
        });

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Ya existe un miembro registrado con este RUT' });
            }
            if (error.code === '22023') {
                return res.status(400).json({ error: error.message });
            }
            throw error;
        }

        const miembro = Array.isArray(data) ? data[0] : data;
        res.status(201).json({ mensaje: 'Miembro registrado correctamente', miembro });
    } catch (err) {
        console.error('Error registrando miembro:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.put('/:id', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre,
            rut,
            correo,
            telefono,
            fecha_bautismo,
            direccion,
            fecha_ingreso,
            activo
        } = req.body;

        if (!nombre?.trim()) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        if (!esRutValido(rut)) {
            return res.status(400).json({ error: 'Ingresa un RUT chileno válido' });
        }

        const { data, error } = await supabase.rpc('actualizar_miembro_con_persona', {
            p_miembro_id: id,
            p_nombre: nombre.trim(),
            p_rut: formatearRut(rut),
            p_correo: correo || null,
            p_telefono: telefono || null,
            p_fecha_bautismo: fecha_bautismo || null,
            p_direccion: direccion || null,
            p_fecha_ingreso: fecha_ingreso || null,
            p_activo: activo !== false,
            p_actor_id: req.usuario.id
        });

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: error.message });
            }
            if (error.code === '22023') {
                return res.status(400).json({ error: error.message });
            }
            if (error.code === 'P0002') {
                return res.status(404).json({ error: error.message });
            }
            throw error;
        }

        const miembro = Array.isArray(data) ? data[0] : data;
        res.json({ mensaje: 'Miembro actualizado correctamente', miembro });
    } catch (err) {
        console.error('Error actualizando miembro:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.delete('/:id', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.from('miembros').update({ activo: false }).eq('id', id).select().single();
        if (error) throw error;
        await supabase.from('auditoria').insert({
            usuario_id: req.usuario.id, accion: 'DESACTIVAR', tabla: 'miembros',
            registro_id: id, datos_antes: data
        });
        res.json({ mensaje: 'Miembro desactivado correctamente' });
    } catch (err) {
        console.error('Error desactivando miembro:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
