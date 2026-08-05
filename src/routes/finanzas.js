const express  = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/finanzas
// ============================================================
router.get('/', verificarToken, verificarRol('superadmin', 'pastor', 'tesorero'), async (req, res) => {
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
// GET /api/finanzas/mi-resumen
// Resumen privado del aporte propio y transparencia mensual.
// Nunca devuelve historiales ni movimientos individuales.
// ============================================================
router.get('/mi-resumen', verificarToken, async (req, res) => {
    try {
        const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
        const anio = ahora.getFullYear();
        const mes = ahora.getMonth() + 1;
        const inicioMes = `${anio}-${String(mes).padStart(2, '0')}-01`;
        const ultimoDia = new Date(anio, mes, 0).getDate();
        const finMes = `${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}`;

        const { data: usuario, error: errorUsuario } = await supabase
            .from('usuarios')
            .select('persona_id')
            .eq('id', req.usuario.id)
            .single();
        if (errorUsuario || !usuario?.persona_id) {
            return res.status(404).json({ error: 'La cuenta no tiene una persona asociada' });
        }

        const { data: miembro, error: errorMiembro } = await supabase
            .from('miembros')
            .select('id, familia_id')
            .eq('persona_id', usuario.persona_id)
            .single();
        if (errorMiembro || !miembro) {
            return res.status(403).json({ error: 'El resumen financiero está disponible para miembros' });
        }

        const filtroAsociacion = [
            `miembro_id.eq.${miembro.id}`,
            miembro.familia_id ? `familia_id.eq.${miembro.familia_id}` : null
        ].filter(Boolean).join(',');

        let queryAporteMes = supabase
            .from('finanzas')
            .select('tipo, monto, fecha, miembro_id, familia_id')
            .gte('fecha', inicioMes)
            .lte('fecha', finMes)
            .order('fecha', { ascending: false });
        queryAporteMes = queryAporteMes.or(filtroAsociacion);

        const [aporteMesResult, ingresosResult, egresosResult] = await Promise.all([
            queryAporteMes,
            supabase.from('finanzas').select('monto').gte('fecha', inicioMes).lte('fecha', finMes),
            supabase.from('egresos').select('categoria, monto').gte('fecha', inicioMes).lte('fecha', finMes)
        ]);
        if (aporteMesResult.error) throw aporteMesResult.error;
        if (ingresosResult.error) throw ingresosResult.error;
        if (egresosResult.error) throw egresosResult.error;

        let aportesPersonales = aporteMesResult.data || [];
        let esMesActual = aportesPersonales.length > 0;

        if (!esMesActual) {
            let queryUltimo = supabase
                .from('finanzas')
                .select('tipo, monto, fecha, miembro_id, familia_id')
                .order('fecha', { ascending: false })
                .limit(1);
            queryUltimo = queryUltimo.or(filtroAsociacion);
            const { data, error } = await queryUltimo;
            if (error) throw error;
            aportesPersonales = data || [];
        }

        const totalAporte = aportesPersonales.reduce((total, item) => total + Number(item.monto), 0);
        const tieneAporteFamiliar = aportesPersonales.some(item =>
            miembro.familia_id && item.familia_id === miembro.familia_id
        );
        const tipos = [...new Set(aportesPersonales.map(item => item.tipo).filter(Boolean))];
        let tipoAporte = tipos.length === 1 ? tipos[0] : (tipos.length ? 'Aportes del mes' : null);
        if (tipoAporte === 'Diezmo de Miembro') {
            tipoAporte = tieneAporteFamiliar ? 'Diezmo familiar' : 'Diezmo individual';
        }

        const egresosPorCategoria = {};
        (egresosResult.data || []).forEach(item => {
            const categoria = item.categoria || 'Otro';
            egresosPorCategoria[categoria] = (egresosPorCategoria[categoria] || 0) + Number(item.monto);
        });

        res.json({
            periodo: {
                anio,
                mes,
                nombre: new Intl.DateTimeFormat('es-CL', { month: 'long' })
                    .format(new Date(anio, mes - 1, 1))
            },
            aporte: aportesPersonales.length ? {
                es_mes_actual: esMesActual,
                tipo: tipoAporte,
                monto: totalAporte,
                fecha: aportesPersonales[0].fecha,
                es_familiar: tieneAporteFamiliar
            } : null,
            transparencia: {
                total_ingresos: (ingresosResult.data || [])
                    .reduce((total, item) => total + Number(item.monto), 0),
                egresos_por_categoria: egresosPorCategoria,
                total_egresos: (egresosResult.data || [])
                    .reduce((total, item) => total + Number(item.monto), 0)
            }
        });
    } catch (err) {
        console.error('Error obteniendo resumen financiero del miembro:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// POST /api/finanzas
// ============================================================
router.post('/', verificarToken, verificarRol('superadmin', 'pastor', 'tesorero'), async (req, res) => {
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

        let nombreServicioFinal = nombre_servicio || null;
        const [anio, mes, diaMes] = String(fecha).split('-').map(Number);
        const fechaValida = Boolean(anio && mes && diaMes);
        const diaSemana = fechaValida
            ? new Date(Date.UTC(anio, mes - 1, diaMes)).getUTCDay()
            : null;
        const esPrimerDomingo = diaSemana === 0 && diaMes <= 7;

        if (tipo === 'Diezmo de Miembro' && esPrimerDomingo) {
            const nombreMes = new Intl.DateTimeFormat('es-CL', {
                month: 'long',
                timeZone: 'UTC'
            }).format(new Date(Date.UTC(anio, mes - 1, 1)));
            nombreServicioFinal = `Diezmo de Santa Cena · ${nombreMes.charAt(0).toUpperCase()}${nombreMes.slice(1)} ${anio}`;
        }

        const { data, error } = await supabase
            .from('finanzas')
            .insert({
                tipo,
                monto:           Number(monto),
                fecha,
                nombre_servicio: nombreServicioFinal,
                servicio_id:     servicio_id     || null,
                miembro_id:      miembro_id      || null,
                familia_id:      familia_id      || null,
                asociado_nombre: asociado_nombre || null,
                anonimo:         anonimo         || false,
                mes_aplicacion:  mes_aplicacion  || null,
                observaciones:   observaciones   || null,
                registrado_por:  req.usuario.id
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
router.put('/:id', verificarToken, verificarRol('superadmin', 'pastor', 'tesorero'), async (req, res) => {
    try {
        const { id } = req.params;

        const { data: antes } = await supabase
            .from('finanzas')
            .select('*')
            .eq('id', id)
            .single();

        const camposPermitidos = [
            'tipo', 'monto', 'fecha', 'nombre_servicio', 'servicio_id',
            'miembro_id', 'familia_id', 'asociado_nombre', 'anonimo',
            'mes_aplicacion', 'observaciones'
        ];
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
            .from('finanzas')
            .update(cambios)
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
router.get('/reporte/:anio', verificarToken, verificarRol('superadmin', 'pastor'), async (req, res) => {
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
