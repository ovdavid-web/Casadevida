const express = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();
const ROLES_SECRETARIA = ['pastor', 'secretaria'];
const ESTADOS_ACTA = ['borrador', 'cerrada', 'anulada'];
const ESTADOS_ACUERDO = ['pendiente', 'en_proceso', 'cumplido', 'cancelado'];

const texto = (valor, maximo = 5000) => {
    const limpio = String(valor || '').trim();
    return limpio ? limpio.slice(0, maximo) : null;
};

async function auditar(usuarioId, accion, tabla, registroId, antes, despues) {
    const { error } = await supabase.from('auditoria').insert({
        usuario_id: usuarioId,
        accion,
        tabla,
        registro_id: registroId,
        datos_antes: antes || null,
        datos_despues: despues || null
    });
    if (error) throw error;
}

router.get('/actas', verificarToken, verificarRol(...ROLES_SECRETARIA), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('actas')
            .select('id, numero, titulo, tipo, fecha, lugar, objetivo, desarrollo, observaciones, estado, creado_en, actualizado_en, acta_participantes(persona_id, calidad, personas(nombres, apellidos)), acuerdos(id, descripcion, responsable_persona_id, fecha_compromiso, estado, observaciones, personas(nombres, apellidos))')
            .order('fecha', { ascending: false })
            .order('numero', { ascending: false });
        if (error) throw error;
        res.json({ actas: data || [] });
    } catch (err) {
        console.error('Error obteniendo actas:', err);
        res.status(500).json({ error: 'No fue posible cargar las actas' });
    }
});

router.post('/actas', verificarToken, verificarRol(...ROLES_SECRETARIA), async (req, res) => {
    try {
        const titulo = texto(req.body.titulo, 180);
        const fecha = req.body.fecha;
        const estado = req.body.estado || 'borrador';
        if (!titulo || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) {
            return res.status(400).json({ error: 'Título y fecha son obligatorios' });
        }
        if (!ESTADOS_ACTA.includes(estado)) return res.status(400).json({ error: 'Estado de acta no válido' });

        const registro = {
            titulo,
            tipo: texto(req.body.tipo, 60) || 'reunion',
            fecha,
            lugar: texto(req.body.lugar, 180),
            objetivo: texto(req.body.objetivo),
            desarrollo: texto(req.body.desarrollo, 20000),
            observaciones: texto(req.body.observaciones),
            estado,
            creado_por: req.usuario.id,
            actualizado_por: req.usuario.id
        };
        const { data, error } = await supabase.from('actas').insert(registro).select().single();
        if (error) throw error;

        const personas = [...new Set((req.body.participantes || []).filter(Boolean))];
        if (personas.length) {
            const { error: errorParticipantes } = await supabase.from('acta_participantes').insert(
                personas.map(persona_id => ({ acta_id: data.id, persona_id }))
            );
            if (errorParticipantes) {
                await supabase.from('actas').delete().eq('id', data.id);
                throw errorParticipantes;
            }
        }
        await auditar(req.usuario.id, 'CREAR', 'actas', data.id, null, { ...data, participantes: personas });
        res.status(201).json({ mensaje: 'Acta registrada correctamente', acta: data });
    } catch (err) {
        console.error('Error creando acta:', err);
        res.status(500).json({ error: 'No fue posible registrar el acta' });
    }
});

router.put('/actas/:id', verificarToken, verificarRol(...ROLES_SECRETARIA), async (req, res) => {
    try {
        const { data: antes, error: errorAntes } = await supabase.from('actas').select('*').eq('id', req.params.id).single();
        if (errorAntes || !antes) return res.status(404).json({ error: 'Acta no encontrada' });
        const estado = req.body.estado || antes.estado;
        if (!ESTADOS_ACTA.includes(estado)) return res.status(400).json({ error: 'Estado de acta no válido' });
        const cambios = {
            titulo: texto(req.body.titulo, 180) || antes.titulo,
            tipo: texto(req.body.tipo, 60) || antes.tipo,
            fecha: req.body.fecha || antes.fecha,
            lugar: texto(req.body.lugar, 180),
            objetivo: texto(req.body.objetivo),
            desarrollo: texto(req.body.desarrollo, 20000),
            observaciones: texto(req.body.observaciones),
            estado,
            actualizado_por: req.usuario.id,
            actualizado_en: new Date().toISOString()
        };
        const { data, error } = await supabase.from('actas').update(cambios).eq('id', req.params.id).select().single();
        if (error) throw error;
        await auditar(req.usuario.id, 'MODIFICAR', 'actas', data.id, antes, data);
        res.json({ mensaje: 'Acta actualizada correctamente', acta: data });
    } catch (err) {
        console.error('Error actualizando acta:', err);
        res.status(500).json({ error: 'No fue posible actualizar el acta' });
    }
});

router.get('/acuerdos', verificarToken, verificarRol(...ROLES_SECRETARIA), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('acuerdos')
            .select('id, acta_id, descripcion, responsable_persona_id, fecha_compromiso, estado, observaciones, creado_en, actualizado_en, actas(numero, titulo, fecha), personas(nombres, apellidos)')
            .order('creado_en', { ascending: false });
        if (error) throw error;
        res.json({ acuerdos: data || [] });
    } catch (err) {
        console.error('Error obteniendo acuerdos:', err);
        res.status(500).json({ error: 'No fue posible cargar los acuerdos' });
    }
});

router.post('/acuerdos', verificarToken, verificarRol(...ROLES_SECRETARIA), async (req, res) => {
    try {
        const descripcion = texto(req.body.descripcion, 5000);
        const estado = req.body.estado || 'pendiente';
        if (!descripcion) return res.status(400).json({ error: 'La descripción del acuerdo es obligatoria' });
        if (!ESTADOS_ACUERDO.includes(estado)) return res.status(400).json({ error: 'Estado de acuerdo no válido' });
        const registro = {
            acta_id: req.body.acta_id || null,
            descripcion,
            responsable_persona_id: req.body.responsable_persona_id || null,
            fecha_compromiso: req.body.fecha_compromiso || null,
            estado,
            observaciones: texto(req.body.observaciones),
            creado_por: req.usuario.id,
            actualizado_por: req.usuario.id
        };
        const { data, error } = await supabase.from('acuerdos').insert(registro).select().single();
        if (error) throw error;
        await auditar(req.usuario.id, 'CREAR', 'acuerdos', data.id, null, data);
        res.status(201).json({ mensaje: 'Acuerdo registrado correctamente', acuerdo: data });
    } catch (err) {
        console.error('Error creando acuerdo:', err);
        res.status(500).json({ error: 'No fue posible registrar el acuerdo' });
    }
});

router.put('/acuerdos/:id', verificarToken, verificarRol(...ROLES_SECRETARIA), async (req, res) => {
    try {
        const { data: antes, error: errorAntes } = await supabase.from('acuerdos').select('*').eq('id', req.params.id).single();
        if (errorAntes || !antes) return res.status(404).json({ error: 'Acuerdo no encontrado' });
        const estado = req.body.estado || antes.estado;
        if (!ESTADOS_ACUERDO.includes(estado)) return res.status(400).json({ error: 'Estado de acuerdo no válido' });
        const cambios = {
            descripcion: texto(req.body.descripcion, 5000) || antes.descripcion,
            responsable_persona_id: req.body.responsable_persona_id || null,
            fecha_compromiso: req.body.fecha_compromiso || null,
            estado,
            observaciones: texto(req.body.observaciones),
            actualizado_por: req.usuario.id,
            actualizado_en: new Date().toISOString()
        };
        const { data, error } = await supabase.from('acuerdos').update(cambios).eq('id', req.params.id).select().single();
        if (error) throw error;
        await auditar(req.usuario.id, 'MODIFICAR', 'acuerdos', data.id, antes, data);
        res.json({ mensaje: 'Acuerdo actualizado correctamente', acuerdo: data });
    } catch (err) {
        console.error('Error actualizando acuerdo:', err);
        res.status(500).json({ error: 'No fue posible actualizar el acuerdo' });
    }
});

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
            .select('id, departamento_id, persona_id, cargo, orden, fecha_inicio, fecha_fin, estado, personas(nombres, apellidos, estado)')
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
