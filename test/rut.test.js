const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizarRut, esRutValido, formatearRut } = require('../src/utils/rut');

test('normaliza y formatea un RUT chileno', () => {
    assert.equal(normalizarRut('12.345.678-5'), '123456785');
    assert.equal(formatearRut('123456785'), '12.345.678-5');
});

test('acepta dígitos verificadores numéricos y K válidos', () => {
    assert.equal(esRutValido('12.345.678-5'), true);
    assert.equal(esRutValido('6.000.000-K'), true);
});

test('rechaza formato y dígito verificador incorrectos', () => {
    assert.equal(esRutValido('12.345.678-9'), false);
    assert.equal(esRutValido('1234'), false);
    assert.equal(esRutValido(''), false);
});
