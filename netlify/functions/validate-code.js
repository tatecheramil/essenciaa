// netlify/functions/validate-code.js
//
// Valida um código de acesso e associa-o ao PRIMEIRO dispositivo que o activar.
// Tentativas seguintes com um dispositivo diferente são rejeitadas.
//
// Requer a dependência "@netlify/blobs" (ver package.json / instruções em baixo).

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ valido: false, erro: 'Method not allowed' }) };
  }

  try {
    const { codigo, dispositivo } = JSON.parse(event.body || '{}');

    if (!codigo || !dispositivo) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valido: false, erro: 'Pedido incompleto.' })
      };
    }

    const codigoLimpo = String(codigo).trim().toUpperCase();

    if (!/^ESS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigoLimpo)) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valido: false, erro: 'Formato de código inválido. Verifica e tenta novamente.' })
      };
    }

    const { getStore } = require('@netlify/blobs');
    const store = getStore('essencia-codigos');

    let registo = null;
    try {
      registo = await store.get(codigoLimpo, { type: 'json' });
    } catch (e) {
      registo = null;
    }

    // Código não existe (nunca foi registado por ti através do admin-add-code)
    if (!registo) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valido: false,
          erro: 'Código não encontrado. Verifica se o introduziste correctamente.'
        })
      };
    }

    // Primeira activação — associa este dispositivo ao código, de forma permanente
    if (!registo.dispositivo) {
      registo.dispositivo = dispositivo;
      registo.activadoEm = new Date().toISOString();
      await store.setJSON(codigoLimpo, registo);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valido: true })
      };
    }

    // Mesmo dispositivo a voltar a validar (ex: reinstalou a app, limpou cache)
    if (registo.dispositivo === dispositivo) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valido: true })
      };
    }

    // Dispositivo diferente — bloqueado
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valido: false,
        erro: 'Este código já está activo noutro dispositivo. Se precisares de ajuda, contacta-nos por email.'
      })
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valido: false, erro: 'Erro no servidor. Tenta novamente em breve.' })
    };
  }
};
