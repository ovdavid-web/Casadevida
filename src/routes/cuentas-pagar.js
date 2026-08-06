const express = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

const CATEGORIAS = [
    'Infraestructura',
    'Pastoral',
    'Operacional',
    'Ministerial',
    'Tecnología',
    'Otro'
];

const FRECUENCIAS = ['unica', 'mensual', 'trimestral', 'semestral', 'anual'];
const accesoLecturaPanel = verificarRol('pastor', 'tesorero');
const accesoFinanciero = verificarRol('tesorero');

router.get('/alertas', verificarToken, verificarRol('pastor', 'secretaria', 'tesorero'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('cuentas_por_pagar')
            .select('id, nombre, proveedor, fecha_vencimiento, frecuencia, estado, fecha_revision, aviso_revision_dias, nota_revision')
            .eq('estado', 'pendiente')
            .order('fecha_vencimiento', { ascending: true });
        if (error) throw error;
        res.json({ cuentas: data || [] });
    } catch (err) {
        console.error('Error obteniendo alertas de cuentas:', err);
        res.status(500).json({ error: 'No fue posible cargar las alertas financieras' });
    }
});

router.get('/', verificarToken, accesoLecturaPanel, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('cuentas_por_pagar')
            .select('*')
            .order('fecha_vencimiento', { ascending: true });

        if (error) throw error;
        res.json({ cuentas: data || [] });
    } catch (err) {
        console.error('Error obteniendo cuentas por pagar:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/', verificarToken, accesoFinanciero, async (req, res) => {
    try {
        const {
            nombre,
            categoria,
            proveedor,
            monto,
            fecha_vencimiento,
            frecuencia,
            observaciones,
            moneda,
            monto_moneda_origen,
            fecha_inicio_servicio,
            fecha_revision,
            aviso_revision_dias,
            nota_revision
        } = req.body;

        const nombreLimpio = String(nombre || '').trim();
        const montoNumerico = monto === null || monto === undefined || monto === ''
            ? null
            : Number(monto);
        const monedaValida = moneda || 'CLP';
        const montoOrigenNumerico = monto_moneda_origen ? Number(monto_moneda_origen) : null;
        const avisoDias = Number.isInteger(Number(aviso_revision_dias)) ? Number(aviso_revision_dias) : 30;

        if (nombreLimpio.length < 2 || nombreLimpio.length > 150) {
            return res.status(400).json({ error: 'Ingresa un nombre válido para la cuenta' });
        }
        if (!fecha_vencimiento || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_vencimiento)) {
            return res.status(400).json({ error: 'La fecha de vencimiento es requerida' });
        }
        if (!CATEGORIAS.includes(categoria)) {
            return res.status(400).json({ error: 'Categoría no válida' });
        }
        if (!FRECUENCIAS.includes(frecuencia)) {
            return res.status(400).json({ error: 'Frecuencia no válida' });
        }
        if (!['CLP', 'USD'].includes(monedaValida)) {
            return res.status(400).json({ error: 'Moneda no válida' });
        }
        if (monedaValida === 'USD' && montoOrigenNumerico !== null && (!Number.isFinite(montoOrigenNumerico) || montoOrigenNumerico <= 0)) {
            return res.status(400).json({ error: 'El monto estimado en USD no es válido' });
        }
        if (avisoDias < 0 || avisoDias > 365) return res.status(400).json({ error: 'La anticipación de revisión no es válida' });
        if (montoNumerico !== null && (!Number.isFinite(montoNumerico) || montoNumerico <= 0)) {
            return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
        }

        const { data, error } = await supabase
            .from('cuentas_por_pagar')
            .insert({
                nombre: nombreLimpio,
                categoria,
                proveedor: String(proveedor || '').trim() || null,
                monto: montoNumerico,
                fecha_vencimiento,
                frecuencia,
                estado: 'pendiente',
                observaciones: String(observaciones || '').trim() || null,
                moneda: monedaValida,
                monto_moneda_origen: monedaValida === 'USD' ? montoOrigenNumerico : null,
                fecha_inicio_servicio: fecha_inicio_servicio || null,
                fecha_revision: fecha_revision || null,
                aviso_revision_dias: avisoDias,
                nota_revision: String(nota_revision || '').trim() || null
            })
            .select()
            .single();

        if (error) throw error;

        await supabase.from('auditoria').insert({
            usuario_id: req.usuario.id,
            accion: 'CREAR',
            tabla: 'cuentas_por_pagar',
            registro_id: data.id,
            datos_despues: data
        });

        res.status(201).json({
            mensaje: 'Cuenta registrada correctamente',
            cuenta: data
        });
    } catch (err) {
        console.error('Error registrando cuenta por pagar:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.put('/:id', verificarToken, accesoFinanciero, async (req, res) => {
    try {
        const { data: antes, error: errorAntes } = await supabase.from('cuentas_por_pagar').select('*').eq('id', req.params.id).single();
        if (errorAntes || !antes) return res.status(404).json({ error: 'Cuenta no encontrada' });
        if (antes.estado !== 'pendiente' || antes.egreso_id) return res.status(400).json({ error: 'Solo se puede editar una cuenta pendiente y sin egreso' });

        const nombre = String(req.body.nombre || '').trim();
        const moneda = req.body.moneda || 'CLP';
        const frecuencia = req.body.frecuencia || 'unica';
        const montoReferencia = req.body.monto_referencia === null || req.body.monto_referencia === '' ? null : Number(req.body.monto_referencia);
        if (nombre.length < 2 || nombre.length > 150) return res.status(400).json({ error: 'Ingresa un nombre válido para la cuenta' });
        if (!CATEGORIAS.includes(req.body.categoria)) return res.status(400).json({ error: 'Categoría no válida' });
        if (!FRECUENCIAS.includes(frecuencia)) return res.status(400).json({ error: 'Frecuencia no válida' });
        if (!['CLP', 'USD'].includes(moneda)) return res.status(400).json({ error: 'Moneda no válida' });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.fecha_vencimiento || '')) return res.status(400).json({ error: 'Vencimiento no válido' });
        if (montoReferencia !== null && (!Number.isFinite(montoReferencia) || montoReferencia <= 0)) return res.status(400).json({ error: 'Monto estimado no válido' });

        const cambios = {
            nombre,
            proveedor: String(req.body.proveedor || '').trim() || null,
            categoria: req.body.categoria,
            monto: moneda === 'CLP' ? montoReferencia : null,
            monto_moneda_origen: moneda === 'USD' ? montoReferencia : null,
            moneda,
            fecha_vencimiento: req.body.fecha_vencimiento,
            frecuencia,
            observaciones: String(req.body.observaciones || '').trim() || null,
            fecha_inicio_servicio: req.body.fecha_inicio_servicio || null,
            fecha_revision: req.body.fecha_revision || null,
            aviso_revision_dias: Number(req.body.aviso_revision_dias || 30),
            nota_revision: String(req.body.nota_revision || '').trim() || null
        };
        const { data, error } = await supabase.from('cuentas_por_pagar').update(cambios).eq('id', req.params.id).eq('estado', 'pendiente').select().single();
        if (error) throw error;
        await supabase.from('auditoria').insert({ usuario_id: req.usuario.id, accion: 'MODIFICAR', tabla: 'cuentas_por_pagar', registro_id: data.id, datos_antes: antes, datos_despues: data });
        res.json({ mensaje: 'Cuenta pendiente actualizada', cuenta: data });
    } catch (err) {
        console.error('Error actualizando cuenta por pagar:', err);
        res.status(500).json({ error: 'No fue posible actualizar la cuenta' });
    }
});

router.patch('/:id/finalizar', verificarToken, accesoFinanciero, async (req, res) => {
    try {
        const motivo = String(req.body.motivo || '').trim();
        if (motivo.length < 5 || motivo.length > 500) return res.status(400).json({ error: 'Indica brevemente el motivo de finalización' });
        const { data: antes, error: errorAntes } = await supabase.from('cuentas_por_pagar').select('*').eq('id', req.params.id).single();
        if (errorAntes || !antes) return res.status(404).json({ error: 'Cuenta no encontrada' });
        if (antes.estado !== 'pendiente' || antes.egreso_id) return res.status(400).json({ error: 'Solo se puede finalizar una cuenta pendiente' });

        const { data, error } = await supabase.from('cuentas_por_pagar').update({
            estado: 'anulada',
            fecha_anulacion: new Date().toISOString(),
            motivo_anulacion: motivo,
            anulada_por: req.usuario.id
        }).eq('id', req.params.id).eq('estado', 'pendiente').select().single();
        if (error) throw error;
        await supabase.from('auditoria').insert({ usuario_id: req.usuario.id, accion: 'FINALIZAR_RECURRENCIA', tabla: 'cuentas_por_pagar', registro_id: data.id, datos_antes: antes, datos_despues: data });
        res.json({ mensaje: 'Recurrencia finalizada; el historial se conservó', cuenta: data });
    } catch (err) {
        console.error('Error finalizando cuenta recurrente:', err);
        res.status(500).json({ error: 'No fue posible finalizar la recurrencia' });
    }
});

router.patch('/:id/pagar', verificarToken, accesoFinanciero, async (req, res) => {
    try {
        const { id } = req.params;
        const montoFinal = Number(req.body.monto);
        const moneda = req.body.moneda || 'CLP';
        const montoOrigen = req.body.monto_origen ? Number(req.body.monto_origen) : null;
        const tipoCambio = req.body.tipo_cambio ? Number(req.body.tipo_cambio) : null;
        const comisionClp = req.body.comision_clp ? Number(req.body.comision_clp) : 0;

        if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
            return res.status(400).json({ error: 'Confirma un monto mayor a 0' });
        }
        if (!['CLP', 'USD'].includes(moneda)) return res.status(400).json({ error: 'Moneda no válida' });
        if (moneda === 'USD' && (!Number.isFinite(montoOrigen) || montoOrigen <= 0 || !Number.isFinite(tipoCambio) || tipoCambio <= 0)) {
            return res.status(400).json({ error: 'Confirma el monto en USD y el tipo de cambio aplicado' });
        }
        if (!Number.isFinite(comisionClp) || comisionClp < 0) return res.status(400).json({ error: 'La comisión no es válida' });

        const { data: antes, error: errorCuenta } = await supabase
            .from('cuentas_por_pagar')
            .select('*')
            .eq('id', id)
            .single();

        if (errorCuenta || !antes) return res.status(404).json({ error: 'Cuenta no encontrada' });
        if (antes.egreso_id) {
            return res.status(400).json({ error: 'Esta cuenta ya tiene un egreso asociado' });
        }
        if (!['pendiente', 'pagada'].includes(antes.estado)) {
            return res.status(400).json({ error: 'La cuenta no puede registrarse como pagada' });
        }

        const fechaChile = req.body.fecha_pago || new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Santiago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaChile)) return res.status(400).json({ error: 'La fecha de pago no es válida' });

        const { data: resultado, error: errorPago } = await supabase.rpc('registrar_pago_cuenta_recurrente', {
            p_cuenta_id: id,
            p_usuario_id: req.usuario.id,
            p_total_clp: montoFinal,
            p_fecha_pago: fechaChile,
            p_moneda: moneda,
            p_monto_origen: moneda === 'USD' ? montoOrigen : null,
            p_tipo_cambio: moneda === 'USD' ? tipoCambio : null,
            p_comision_clp: comisionClp
        });
        if (errorPago) throw errorPago;

        res.json({
            mensaje: resultado?.siguiente
                ? 'Pago confirmado; egreso y próximo vencimiento registrados'
                : 'Pago confirmado y egreso registrado',
            cuenta: resultado?.cuenta,
            egreso: resultado?.egreso,
            siguiente: resultado?.siguiente || null,
            egreso_generado: true
        });
    } catch (err) {
        console.error('Error marcando cuenta como pagada:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
