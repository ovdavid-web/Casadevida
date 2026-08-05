function normalizarRut(rut) {
    return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

function esRutValido(rut) {
    const normalizado = normalizarRut(rut);
    if (!/^\d{7,8}[\dK]$/.test(normalizado)) return false;

    const cuerpo = normalizado.slice(0, -1);
    const dv = normalizado.slice(-1);
    let suma = 0;
    let factor = 2;

    for (let indice = cuerpo.length - 1; indice >= 0; indice -= 1) {
        suma += Number(cuerpo[indice]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }

    const resto = 11 - (suma % 11);
    const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
    return dv === esperado;
}

function formatearRut(rut) {
    const normalizado = normalizarRut(rut);
    if (normalizado.length < 2) return normalizado;

    const cuerpo = normalizado.slice(0, -1);
    const dv = normalizado.slice(-1);
    return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}

module.exports = { normalizarRut, esRutValido, formatearRut };
