const express  = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/egresos
// Lista todos los egresos
// ============================================================
router.get('/', verificarToken, verificarRol('superadmin', 'pastor', 'tesorero'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('egresos')
            .select('*')
            .order('fecha', { ascending: false });

        if (error) throw error;

        const totales = {
            total:          data.reduce((s,r) => s + Number(r.monto), 0),
            infraestructura: data.filter(r => r.categoria === 'Infraestructura').reduce((s,r) => s + Number(r.monto), 0),
            pastoral:        data.filter(r => r.categoria === 'Pastoral').reduce((s,r) => s + Number(r.monto), 0),
            operacional:     data.filter(r => r.categoria === 'Operacional').reduce((s,r) => s + Number(r.monto), 0),
            ministerial:     data.filter(r => r.categoria === 'Ministerial').reduce((s,r) => s + Number(r.monto), 0),
            tecnologia:      data.filter(r => r.categoria === 'Tecnología').reduce((s,r) => s + Number(r.monto), 0),
            otro:            data.filter(r => r.categoria === 'Otro').reduce((s,r) => s + Number(r.monto), 0),
        };

        res.json({ egresos: data, totales, total_registros: data.length });

    } catch (err) {
        console.error('Error obteniendo egresos:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// POST /api/egresos
// Registra un nuevo egreso
// ============================================================
router.post('/', verificarToken, verificarRol('superadmin', 'tesorero'), async (req, res) => {
    try {
        const {
            item,
            categoria,
            proveedor,
            monto,
            fecha,
            observaciones,
            registrado_por
        } = req.body;

        if (!item || !monto || !fecha) {
            return res.status(400).json({ error: 'Ítem, monto y fecha son requeridos' });
        }
        if (isNaN(monto) || Number(monto) <= 0) {
            return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
        }

        const { data, error } = await supabase
            .from('egresos')
            .insert({
                item,
                categoria,
                proveedor:      proveedor     || null,
                monto:          Number(monto),
                fecha,
                observaciones:  observaciones || null,
                registrado_por: req.usuario.id
            })
            .select()
            .single();

        if (error) throw error;

        await supabase.from('auditoria').insert({
            usuario_id:    req.usuario.id,
            accion:        'CREAR',
            tabla:         'egresos',
            registro_id:   data.id,
            datos_despues: data
        });

        res.status(201).json({ mensaje: 'Egreso registrado correctamente', egreso: data });

    } catch (err) {
        console.error('Error registrando egreso:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// PUT /api/egresos/:id
// Actualiza un egreso
// ============================================================
router.put('/:id', verificarToken, verificarRol('superadmin', 'tesorero'), async (req, res) => {
    try {
        const { id } = req.params;

        const { data: antes } = await supabase
            .from('egresos')
            .select('*')
            .eq('id', id)
            .single();

        const camposPermitidos = ['item', 'categoria', 'proveedor', 'monto', 'fecha', 'observaciones'];
        const cambios = Object.fromEntries(
            camposPermitidos
                .filter(campo => Object.prototype.hasOwnProperty.call(req.body, campo))
                .map(campo => [campo, req.body[campo]])
        );
        if (!Object.keys(cambios).length) {
            return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
        }
        if (Object.prototype.hasOwnProperty.call(cambios, 'monto')) {
            const montoNumerico = Number(cambios.monto);
            if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
                return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
            }
            cambios.monto = montoNumerico;
        }
        if (cambios.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(cambios.fecha)) {
            return res.status(400).json({ error: 'La fecha no es válida' });
        }

        const { data, error } = await supabase
            .from('egresos')
            .update(cambios)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await supabase.from('auditoria').insert({
            usuario_id:    req.usuario.id,
            accion:        'MODIFICAR',
            tabla:         'egresos',
            registro_id:   id,
            datos_antes:   antes,
            datos_despues: data
        });

        res.json({ mensaje: 'Egreso actualizado correctamente', egreso: data });

    } catch (err) {
        console.error('Error actualizando egreso:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// DELETE /api/egresos/:id
// Elimina un egreso
// ============================================================
router.delete('/:id', verificarToken, verificarRol('superadmin', 'tesorero'), async (req, res) => {
    res.status(405).json({
        error: 'Los egresos no se eliminan físicamente. Debe implementarse una anulación auditada.'
    });
});

// ============================================================
// GET /api/egresos/reporte/:anio
// Reporte anual de egresos
// ============================================================
router.get('/reporte/:anio', verificarToken, verificarRol('superadmin', 'pastor', 'tesorero'), async (req, res) => {
    try {
        const { anio } = req.params;

        const { data, error } = await supabase
            .from('egresos')
            .select('*')
            .gte('fecha', `${anio}-01-01`)
            .lte('fecha', `${anio}-12-31`)
            .order('fecha', { ascending: true });

        if (error) throw error;

        const porCategoria = {};
        data.forEach(r => {
            if (!porCategoria[r.categoria]) porCategoria[r.categoria] = 0;
            porCategoria[r.categoria] += Number(r.monto);
        });

        const totalAnual = data.reduce((s,r) => s + Number(r.monto), 0);

        res.json({ anio, porCategoria, totalAnual, total_registros: data.length });

    } catch (err) {
        console.error('Error generando reporte:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
