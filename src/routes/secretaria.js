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

const normalizarBusqueda = valor => valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

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

router.get('/participantes', verificarToken, verificarRol(...ROLES_SECRETARIA), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('personas')
            .select('id, nombres, apellidos, estado, vinculos_iglesia(estado), persona_roles(activo, roles(codigo, nombre))')
            .order('nombres', { ascending: true });
        if (error) throw error;
        const personas = (data || []).filter(persona => {
            const vinculos = persona.vinculos_iglesia || [];
            return vinculos.some(vinculo => vinculo.estado === 'activo') || (!vinculos.length && persona.estado === 'activo');
        }).map(persona => ({
            id: persona.id,
            nombre: [persona.nombres, persona.apellidos].filter(Boolean).join(' '),
            estado: 'activo',
            roles: (persona.persona_roles || [])
                .filter(asignacion => asignacion.activo && asignacion.roles)
                .map(asignacion => ({
                    codigo: Array.isArray(asignacion.roles) ? asignacion.roles[0]?.codigo : asignacion.roles.codigo,
                    nombre: Array.isArray(asignacion.roles) ? asignacion.roles[0]?.nombre : asignacion.roles.nombre
                }))
                .filter(rol => rol.codigo)
        }));
        res.json({ personas });
    } catch (err) {
        console.error('Error obteniendo participantes de actas:', err);
        res.status(500).json({ error: 'No fue posible cargar los participantes' });
    }
});

router.get('/actas', verificarToken, verificarRol(...ROLES_SECRETARIA), async (req, res) => {
    try {
        let consulta = supabase
            .from('actas')
            .select('id, numero, titulo, tipo, fecha, lugar, objetivo, desarrollo, observaciones, estado, creado_en, actualizado_en, cerrada_en, reabierta_en, motivo_reapertura, acta_participantes(persona_id, calidad, personas(nombres, apellidos)), acuerdos(id, descripcion, responsable_persona_id, fecha_compromiso, estado, observaciones, personas(nombres, apellidos))');
        const busqueda = texto(req.query.q, 120);
        if (busqueda) {
            if (/^\d+$/.test(busqueda)) {
                consulta = consulta.eq('numero', Number(busqueda));
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(busqueda)) {
                consulta = consulta.eq('fecha', busqueda);
            } else {
                consulta = consulta.textSearch('busqueda_normalizada', normalizarBusqueda(busqueda), { config: 'spanish', type: 'websearch' });
            }
        }
        const { data, error } = await consulta
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
        if (antes.estado !== 'borrador') return res.status(400).json({ error: 'Solo se puede editar un acta en borrador' });
        const cambios = {
            titulo: texto(req.body.titulo, 180) || antes.titulo,
            tipo: texto(req.body.tipo, 60) || antes.tipo,
            fecha: req.body.fecha || antes.fecha,
            lugar: texto(req.body.lugar, 180),
            objetivo: texto(req.body.objetivo),
            desarrollo: texto(req.body.desarrollo, 20000),
            observaciones: texto(req.body.observaciones),
            estado: 'borrador',
            actualizado_por: req.usuario.id,
            actualizado_en: new Date().toISOString()
        };
        const { data, error } = await supabase.from('actas').update(cambios).eq('id', req.params.id).select().single();
        if (error) throw error;
        let participantesAntes = null;
        let participantesDespues = null;
        if (Array.isArray(req.body.participantes)) {
            const personas = [...new Set(req.body.participantes.filter(Boolean))];
            const { data: actuales, error: errorActuales } = await supabase.from('acta_participantes').select('persona_id').eq('acta_id', req.params.id);
            if (errorActuales) throw errorActuales;
            participantesAntes = (actuales || []).map(item => item.persona_id);
            const anteriores = new Set(participantesAntes);
            const nuevos = personas.filter(personaId => !anteriores.has(personaId));
            const retirados = participantesAntes.filter(personaId => !personas.includes(personaId));
            if (nuevos.length) {
                const { error: errorInsertar } = await supabase.from('acta_participantes').insert(nuevos.map(persona_id => ({ acta_id: req.params.id, persona_id })));
                if (errorInsertar) throw errorInsertar;
            }
            if (retirados.length) {
                const { error: errorBorrar } = await supabase.from('acta_participantes').delete().eq('acta_id', req.params.id).in('persona_id', retirados);
                if (errorBorrar) throw errorBorrar;
            }
            participantesDespues = personas;
        }
        await auditar(req.usuario.id, 'MODIFICAR', 'actas', data.id,
            participantesAntes ? { ...antes, participantes: participantesAntes } : antes,
            participantesDespues ? { ...data, participantes: participantesDespues } : data);
        res.json({ mensaje: 'Acta actualizada correctamente', acta: data });
    } catch (err) {
        console.error('Error actualizando acta:', err);
        res.status(500).json({ error: 'No fue posible actualizar el acta' });
    }
});

router.patch('/actas/:id/cerrar', verificarToken, verificarRol(...ROLES_SECRETARIA), async (req, res) => {
    try {
        const { data: antes, error: errorAntes } = await supabase.from('actas').select('*').eq('id', req.params.id).single();
        if (errorAntes || !antes) return res.status(404).json({ error: 'Acta no encontrada' });
        if (antes.estado !== 'borrador') return res.status(400).json({ error: 'Solo se puede cerrar un acta en borrador' });
        const { data, error } = await supabase.from('actas').update({ estado:'cerrada', cerrada_en:new Date().toISOString(), cerrada_por:req.usuario.id, actualizado_por:req.usuario.id, actualizado_en:new Date().toISOString() }).eq('id', req.params.id).eq('estado','borrador').select().single();
        if (error) throw error;
        await auditar(req.usuario.id, 'CERRAR', 'actas', data.id, antes, data);
        res.json({ mensaje:'Acta confirmada y protegida', acta:data });
    } catch (err) {
        console.error('Error cerrando acta:', err);
        res.status(500).json({ error:'No fue posible confirmar el acta' });
    }
});

router.patch('/actas/:id/reabrir', verificarToken, verificarRol(...ROLES_SECRETARIA), async (req, res) => {
    try {
        const motivo = texto(req.body.motivo, 500);
        if (!motivo || motivo.length < 5) return res.status(400).json({ error:'Indica el motivo de reapertura' });
        const { data: antes, error: errorAntes } = await supabase.from('actas').select('*').eq('id', req.params.id).single();
        if (errorAntes || !antes) return res.status(404).json({ error:'Acta no encontrada' });
        if (antes.estado !== 'cerrada') return res.status(400).json({ error:'Solo se puede reabrir un acta cerrada' });
        const { data, error } = await supabase.from('actas').update({ estado:'borrador', reabierta_en:new Date().toISOString(), reabierta_por:req.usuario.id, motivo_reapertura:motivo, actualizado_por:req.usuario.id, actualizado_en:new Date().toISOString() }).eq('id', req.params.id).eq('estado','cerrada').select().single();
        if (error) throw error;
        await auditar(req.usuario.id, 'REABRIR', 'actas', data.id, antes, data);
        res.json({ mensaje:'Acta reabierta como borrador', acta:data });
    } catch (err) {
        console.error('Error reabriendo acta:', err);
        res.status(500).json({ error:'No fue posible reabrir el acta' });
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
