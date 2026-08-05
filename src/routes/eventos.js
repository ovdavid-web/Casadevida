const express  = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

const ESTADOS_VALIDOS = ['borrador', 'confirmado', 'suspendido', 'realizado'];
const VISIBILIDADES_VALIDAS = ['interna', 'congregacion', 'publica'];
const TIPOS_IMAGEN = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp'
};

function imagenValida(buffer, tipo) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
    if (tipo === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (tipo === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (tipo === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    return false;
}

function prepararEvento(body) {
    const evento = {
        titulo:              body.titulo?.trim(),
        descripcion:         body.descripcion?.trim() || null,
        descripcion_publica: body.descripcion_publica?.trim() || null,
        tipo:                body.tipo?.trim() || 'Otro',
        organizador:         body.organizador?.trim() || null,
        ubicacion:           body.ubicacion?.trim() || null,
        responsable:         body.responsable?.trim() || null,
        fecha_inicio:        body.fecha_inicio,
        fecha_fin:           body.fecha_fin || null,
        estado:              body.estado || 'borrador',
        visibilidad:         body.visibilidad || 'interna',
        publicar_home:       Boolean(body.publicar_home),
        destacado:           Boolean(body.destacado),
        incluir_avisos:      Boolean(body.incluir_avisos),
        publicar_rrss:       Boolean(body.publicar_rrss),
        miniatura_url:       null
    };

    if (!evento.titulo || !evento.fecha_inicio) {
        return { error: 'Título y fecha de inicio son requeridos' };
    }
    if (!ESTADOS_VALIDOS.includes(evento.estado)) {
        return { error: 'Estado de evento no válido' };
    }
    if (!VISIBILIDADES_VALIDAS.includes(evento.visibilidad)) {
        return { error: 'Visibilidad de evento no válida' };
    }
    if (Number.isNaN(Date.parse(evento.fecha_inicio)) ||
        (evento.fecha_fin && Number.isNaN(Date.parse(evento.fecha_fin)))) {
        return { error: 'Las fechas del evento no son válidas' };
    }
    if (evento.fecha_fin && new Date(evento.fecha_fin) < new Date(evento.fecha_inicio)) {
        return { error: 'La fecha de término no puede ser anterior al inicio' };
    }
    if (evento.publicar_home && evento.visibilidad !== 'publica') {
        return { error: 'Solo un evento público puede publicarse en el home' };
    }

    return { evento };
}

router.get('/', verificarToken, verificarRol('pastor', 'tesorero', 'oficial'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('eventos').select('*').order('fecha_inicio', { ascending: true });
        if (error) throw error;
        res.json({ eventos: data, total: data.length });
    } catch (err) {
        console.error('Error obteniendo eventos:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        const preparado = prepararEvento(req.body);
        if (preparado.error) return res.status(400).json({ error: preparado.error });

        const { data, error } = await supabase
            .from('eventos').insert(preparado.evento).select().single();
        if (error) throw error;

        await supabase.from('auditoria').insert({
            usuario_id: req.usuario.id, accion: 'CREAR', tabla: 'eventos',
            registro_id: data.id, datos_despues: data
        });

        res.status(201).json({ mensaje: 'Evento creado correctamente', evento: data });
    } catch (err) {
        console.error('Error creando evento:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post(
    '/:id/miniatura',
    verificarToken,
    verificarRol('pastor'),
    express.raw({ type: Object.keys(TIPOS_IMAGEN), limit: 307200 }),
    async (req, res) => {
        try {
            const { id } = req.params;
            const tipo = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
            const extension = TIPOS_IMAGEN[tipo];

            if (!extension || !imagenValida(req.body, tipo)) {
                return res.status(400).json({ error: 'La miniatura debe ser una imagen JPG, PNG o WebP válida' });
            }

            const { data: evento, error: errorEvento } = await supabase
                .from('eventos').select('id, miniatura_url').eq('id', id).single();
            if (errorEvento || !evento) return res.status(404).json({ error: 'Evento no encontrado' });

            const ruta = `${id}/miniatura.${extension}`;
            const { error: errorSubida } = await supabase.storage
                .from('eventos-publicos')
                .upload(ruta, req.body, { contentType: tipo, upsert: true, cacheControl: '3600' });
            if (errorSubida) throw errorSubida;

            const extensionesAnteriores = ['jpg', 'png', 'webp']
                .filter(item => item !== extension)
                .map(item => `${id}/miniatura.${item}`);
            await supabase.storage.from('eventos-publicos').remove(extensionesAnteriores);

            const { data: urlData } = supabase.storage.from('eventos-publicos').getPublicUrl(ruta);
            const miniaturaUrl = `${urlData.publicUrl}?v=${Date.now()}`;

            const { data, error } = await supabase
                .from('eventos')
                .update({ miniatura_url: miniaturaUrl, actualizado_en: new Date().toISOString() })
                .eq('id', id).select().single();
            if (error) throw error;

            await supabase.from('auditoria').insert({
                usuario_id: req.usuario.id, accion: 'ACTUALIZAR_MINIATURA', tabla: 'eventos',
                registro_id: id, datos_despues: { miniatura_url: miniaturaUrl }
            });

            res.json({ mensaje: 'Miniatura guardada correctamente', evento: data });
        } catch (err) {
            console.error('Error guardando miniatura:', err);
            res.status(500).json({ error: 'No fue posible guardar la miniatura' });
        }
    }
);

router.put('/:id', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        const { id } = req.params;
        const preparado = prepararEvento(req.body);
        if (preparado.error) return res.status(400).json({ error: preparado.error });

        const { data: antes, error: errorAntes } = await supabase
            .from('eventos').select('*').eq('id', id).single();
        if (errorAntes || !antes) return res.status(404).json({ error: 'Evento no encontrado' });
        preparado.evento.miniatura_url = antes.miniatura_url;

        const { data, error } = await supabase
            .from('eventos')
            .update({
                ...preparado.evento,
                motivo_suspension: preparado.evento.estado === 'suspendido' ? antes.motivo_suspension : null,
                actualizado_en: new Date().toISOString()
            })
            .eq('id', id).select().single();
        if (error) throw error;

        await supabase.from('auditoria').insert({
            usuario_id: req.usuario.id, accion: 'MODIFICAR', tabla: 'eventos',
            registro_id: id, datos_antes: antes, datos_despues: data
        });

        res.json({ mensaje: 'Evento actualizado correctamente', evento: data });
    } catch (err) {
        console.error('Error actualizando evento:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.delete('/:id', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        const { id } = req.params;
        const motivoSuspension = req.body.motivo_suspension?.trim();
        if (!motivoSuspension) {
            return res.status(400).json({ error: 'El motivo de suspensión es requerido' });
        }
        const { data, error } = await supabase
            .from('eventos')
            .update({
                estado: 'suspendido',
                publicar_home: false,
                motivo_suspension: motivoSuspension,
                actualizado_en: new Date().toISOString()
            })
            .eq('id', id).select().single();
        if (error || !data) return res.status(404).json({ error: 'Evento no encontrado' });

        await supabase.from('auditoria').insert({
            usuario_id: req.usuario.id, accion: 'SUSPENDER', tabla: 'eventos',
            registro_id: id, datos_despues: data
        });

        res.json({ mensaje: 'Evento suspendido correctamente', evento: data });
    } catch (err) {
        console.error('Error suspendiendo evento:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
