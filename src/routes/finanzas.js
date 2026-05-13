const express  = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/finanzas
// ============================================================
router.get('/', verificarToken, async (req, res) => {
    try {
        const { mes, anio } = req.query;

        let query = supabase
            .from('finanzas')
            .select('*')
            .order('fecha', { ascending: false });

        if (mes && anio) {
            const inicio = `${anio}-${mes.padStart(2,'0')}-01`;
            const fin    = `${anio}-${mes.padStart(2,'0')}-31`;
            query = query.gte('fecha', inicio).lte('fecha', fin);
        }

        const { data, error } = await query;
        if (error) throw error;

        const totales = {
            total:      data.reduce((sum, r) => sum + Number(r.monto), 0),
            diezmos:    data.filter(r => r.tipo === 'Diezmo de Miembro').reduce((sum, r) => sum + Number(r.monto), 0),
            ofrendas:   data.filter(r => r.tipo.includes('Ofrenda')).reduce((sum, r) => sum + Number(r.monto), 0),
            donaciones: data.filter(r => r.tipo === 'Donación Especial').reduce((sum, r) => sum + Number(r.monto), 0),
        };

        res.json({ registros: data, totales, total_registros: data.length });

    } catch (err) {
        console.error('Error obteniendo finanzas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// POST /api/finanzas
// ============================================================
router.post('/', verificarToken, verificarRol('superadmin', 'pastor', 'oficial'), async (req, res) => {
    try {
        const {
            tipo,
            monto,
            fecha,
            nombre_servicio,
            servicio_id,
            miembro_id,
            familia_id,
            asociado_nombre,
            anonimo,
            mes_aplicacion,
            observaciones,
            registrado_por
        } = req.body;

        if (!tipo || !monto || !fecha) {
            return res.status(400).json({ error: 'Tipo, monto y fecha son requeridos' });
        }
        if (isNaN(monto) || Number(monto) <= 0) {
            return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
        }

        const { data, error } = await supabase
            .from('finanzas')
            .insert({
                tipo,
                monto:           Number(monto),
                fecha,
                nombre_servicio: nombre_servicio || null,
                servicio_id:     servicio_id     || null,
                miembro_id:      miembro_id      || null,
                familia_id:      familia_id      || null,
                asociado_nombre: asociado_nombre || null,
                anonimo:         anonimo         || false,
                mes_aplicacion:  mes_aplicacion  || null,
                observaciones:   observaciones   || null,
                registrado_por:  registrado_por  || null
            })
            .select()
            .single();

        if (error) throw error;

        await supabase.from('auditoria').insert({
            usuario_id:    req.usuario.id,
            accion:        'CREAR',
            tabla:         'finanzas',
            registro_id:   data.id,
            datos_despues: data
        });

        res.status(201).json({ mensaje: 'Ingreso registrado correctamente', registro: data });

    } catch (err) {
        console.error('Error registrando ingreso:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// PUT /api/finanzas/:id
// ============================================================
router.put('/:id', verificarToken, verificarRol('superadmin', 'pastor', 'oficial'), async (req, res) => {
    try {
        const { id } = req.params;

        const { data: antes } = await supabase
            .from('finanzas')
            .select('*')
            .eq('id', id)
            .single();

        const { data, error } = await supabase
            .from('finanzas')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await supabase.from('auditoria').insert({
            usuario_id:    req.usuario.id,
            accion:        'MODIFICAR',
            tabla:         'finanzas',
            registro_id:   id,
            datos_antes:   antes,
            datos_despues: data
        });

        res.json({ mensaje: 'Registro actualizado correctamente', registro: data });

    } catch (err) {
        console.error('Error actualizando registro:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// GET /api/finanzas/reporte/:anio
// ============================================================
router.get('/reporte/:anio', verificarToken, verificarRol('superadmin', 'pastor', 'oficial'), async (req, res) => {
    try {
        const { anio } = req.params;

        const { data, error } = await supabase
            .from('finanzas')
            .select('*')
            .gte('fecha', `${anio}-01-01`)
            .lte('fecha', `${anio}-12-31`)
            .order('fecha', { ascending: true });

        if (error) throw error;

        const porMes = {};
        data.forEach(r => {
            const mes = r.fecha.substring(0, 7);
            if (!porMes[mes]) {
                porMes[mes] = { total: 0, diezmos: 0, ofrendas: 0, donaciones: 0, registros: 0 };
            }
            porMes[mes].total     += Number(r.monto);
            porMes[mes].registros += 1;
            if (r.tipo === 'Diezmo de Miembro') porMes[mes].diezmos    += Number(r.monto);
            if (r.tipo.includes('Ofrenda'))      porMes[mes].ofrendas   += Number(r.monto);
            if (r.tipo === 'Donación Especial')  porMes[mes].donaciones += Number(r.monto);
        });

        const totalAnual = data.reduce((sum, r) => sum + Number(r.monto), 0);

        res.json({ anio, porMes, totalAnual, total_registros: data.length });

    } catch (err) {
        console.error('Error generando reporte:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;