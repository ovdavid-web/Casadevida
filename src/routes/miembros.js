const express  = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('miembros')
            .select('*')
            .order('nombre', { ascending: true });
        if (error) throw error;
        res.json({ miembros: data, total: data.length });
    } catch (err) {
        console.error('Error obteniendo miembros:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/:id', verificarToken, async (req, res) => {
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

router.post('/', verificarToken, verificarRol('pastor', 'oficial'), async (req, res) => {
    try {
        const { nombre, rut, correo, telefono, fecha_bautismo, area_servicio, direccion, fecha_ingreso } = req.body;
        if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
        const { data, error } = await supabase
            .from('miembros')
            .insert({ nombre, rut, correo, telefono, fecha_bautismo, area_servicio, direccion,
                fecha_ingreso: fecha_ingreso || new Date().toISOString().split('T')[0], activo: true })
            .select().single();
        if (error) throw error;
        await supabase.from('auditoria').insert({
            usuario_id: req.usuario.id, accion: 'CREAR', tabla: 'miembros',
            registro_id: data.id, datos_despues: data
        });
        res.status(201).json({ mensaje: 'Miembro registrado correctamente', miembro: data });
    } catch (err) {
        console.error('Error registrando miembro:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.put('/:id', verificarToken, verificarRol('pastor', 'oficial'), async (req, res) => {
    try {
        const { id } = req.params;
        const { data: antes } = await supabase.from('miembros').select('*').eq('id', id).single();
        const { data, error } = await supabase.from('miembros').update(req.body).eq('id', id).select().single();
        if (error) throw error;
        await supabase.from('auditoria').insert({
            usuario_id: req.usuario.id, accion: 'MODIFICAR', tabla: 'miembros',
            registro_id: id, datos_antes: antes, datos_despues: data
        });
        res.json({ mensaje: 'Miembro actualizado correctamente', miembro: data });
    } catch (err) {
        console.error('Error actualizando miembro:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.delete('/:id', verificarToken, verificarRol('pastor', 'oficial'), async (req, res) => {
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