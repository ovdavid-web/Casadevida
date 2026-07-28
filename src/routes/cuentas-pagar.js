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
const accesoFinanciero = verificarRol('pastor', 'tesorero');

router.get('/', verificarToken, accesoFinanciero, async (req, res) => {
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
            observaciones
        } = req.body;

        const nombreLimpio = String(nombre || '').trim();
        const montoNumerico = monto === null || monto === undefined || monto === ''
            ? null
            : Number(monto);

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
                observaciones: String(observaciones || '').trim() || null
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

router.patch('/:id/pagar', verificarToken, accesoFinanciero, async (req, res) => {
    try {
        const { id } = req.params;
        const montoFinal = Number(req.body.monto);

        if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
            return res.status(400).json({ error: 'Confirma un monto mayor a 0' });
        }

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

        const fechaChile = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Santiago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        const { data: egreso, error: errorEgreso } = await supabase
            .from('egresos')
            .insert({
                item: antes.nombre,
                categoria: antes.categoria,
                proveedor: antes.proveedor || null,
                monto: montoFinal,
                fecha: antes.fecha_pago
                    ? new Date(antes.fecha_pago).toISOString().slice(0, 10)
                    : fechaChile,
                observaciones: antes.observaciones
                    ? `Cuenta por pagar: ${antes.observaciones}`
                    : 'Generado desde cuentas por pagar',
                registrado_por: req.usuario.id
            })
            .select()
            .single();

        if (errorEgreso) throw errorEgreso;

        const { data: cuenta, error: errorActualizacion } = await supabase
            .from('cuentas_por_pagar')
            .update({
                estado: 'pagada',
                fecha_pago: antes.fecha_pago || new Date().toISOString(),
                monto: montoFinal,
                egreso_id: egreso.id
            })
            .eq('id', id)
            .is('egreso_id', null)
            .select()
            .single();

        if (errorActualizacion || !cuenta) {
            await supabase.from('egresos').delete().eq('id', egreso.id);
            throw errorActualizacion || new Error('No fue posible vincular el egreso');
        }

        await supabase.from('auditoria').insert({
            usuario_id: req.usuario.id,
            accion: 'MARCAR_PAGADA',
            tabla: 'cuentas_por_pagar',
            registro_id: id,
            datos_antes: antes,
            datos_despues: cuenta
        });

        res.json({
            mensaje: 'Pago confirmado y egreso registrado',
            cuenta,
            egreso,
            egreso_generado: true
        });
    } catch (err) {
        console.error('Error marcando cuenta como pagada:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
