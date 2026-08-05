const express  = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/servicios
// Obtiene todos los servicios programados
// ============================================================
router.get('/', verificarToken, verificarRol('pastor', 'oficial', 'lider'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('servicios')
            .select('*')
            .order('fecha', { ascending: true });

        if (error) throw error;

        res.json({ servicios: data, total: data.length });

    } catch (err) {
        console.error('Error obteniendo servicios:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// POST /api/servicios
// Crea un nuevo servicio
// ============================================================
router.post('/', verificarToken, verificarRol('superadmin', 'pastor'), async (req, res) => {
    try {
        const {
            nombre,
            fecha,
            hora,
            tipo,
            ubicacion,
            observaciones
        } = req.body;

        if (!nombre || !fecha || !hora) {
            return res.status(400).json({
                error: 'Nombre, fecha y hora son requeridos'
            });
        }

        const { data, error } = await supabase
            .from('servicios')
            .insert({
                nombre,
                fecha,
                hora,
                tipo:          tipo || 'presencial',
                ubicacion:     ubicacion || 'Santa Julia 833, La Florida',
                observaciones,
                estado:        'programado'
            })
            .select()
            .single();

        if (error) throw error;

        await supabase.from('auditoria').insert({
            accion:        'CREAR',
            tabla:         'servicios',
            registro_id:   data.id,
            datos_despues: data
        });

        res.status(201).json({
            mensaje:  'Servicio creado correctamente',
            servicio: data
        });

    } catch (err) {
        console.error('Error creando servicio:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// GET /api/servicios/:id/voluntarios
// Obtiene los voluntarios asignados a un servicio
// ============================================================
router.get('/:id/voluntarios', verificarToken, verificarRol('superadmin', 'pastor'), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('asignaciones')
            .select(`
                *,
                miembro:miembro_id (
                    id,
                    nombre,
                    telefono
                )
            `)
            .eq('servicio_id', id);

        if (error) throw error;

        const asignados    = data.filter(a => a.estado === 'confirmado');
        const pendientes   = data.filter(a => a.estado === 'pendiente');
        const no_disponible = data.filter(a => a.estado === 'no_disponible');
        const sin_respuesta = data.filter(a => a.estado === 'sin_respuesta');

        res.json({
            asignaciones: data,
            resumen: {
                total:          data.length,
                confirmados:    asignados.length,
                pendientes:     pendientes.length,
                no_disponible:  no_disponible.length,
                sin_respuesta:  sin_respuesta.length
            }
        });

    } catch (err) {
        console.error('Error obteniendo voluntarios:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// POST /api/servicios/:id/asignar
// Asigna un voluntario a un servicio
// ============================================================
router.post('/:id/asignar', verificarToken, verificarRol('superadmin', 'pastor'), async (req, res) => {
    try {
        const { id }         = req.params;
        const { miembro_id, rol } = req.body;

        if (!miembro_id || !rol) {
            return res.status(400).json({
                error: 'miembro_id y rol son requeridos'
            });
        }

        const { data, error } = await supabase
            .from('asignaciones')
            .insert({
                servicio_id: id,
                miembro_id,
                rol,
                estado: 'pendiente'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            mensaje:    'Voluntario asignado correctamente',
            asignacion: data
        });

    } catch (err) {
        console.error('Error asignando voluntario:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// PUT /api/servicios/respuesta/:asignacion_id
// El voluntario responde su disponibilidad (1, 2 o 3)
// Este endpoint lo usará el bot de WhatsApp
// ============================================================
router.put('/respuesta/:asignacion_id', verificarToken, verificarRol('superadmin', 'pastor'), async (req, res) => {
    try {
        const { asignacion_id } = req.params;
        const { respuesta }     = req.body; // 1, 2 o 3

        const estados = {
            '1': 'confirmado',
            '2': 'no_disponible',
            '3': 'pendiente'
        };

        const estado = estados[String(respuesta)];
        if (!estado) {
            return res.status(400).json({
                error: 'Respuesta inválida. Debe ser 1, 2 o 3'
            });
        }

        const { data, error } = await supabase
            .from('asignaciones')
            .update({
                estado,
                fecha_respuesta: new Date().toISOString()
            })
            .eq('id', asignacion_id)
            .select()
            .single();

        if (error) throw error;

        await supabase.from('auditoria').insert({
            accion:        'RESPUESTA_VOLUNTARIO',
            tabla:         'asignaciones',
            registro_id:   asignacion_id,
            datos_despues: data
        });

        res.json({
            mensaje: `Respuesta registrada: ${estado}`,
            asignacion: data
        });

    } catch (err) {
        console.error('Error registrando respuesta:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
