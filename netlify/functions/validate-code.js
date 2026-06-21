// netlify/functions/validate-code.js
//
// Valida um código de acesso. Cada código pode ser activado em até
// DEVICE_LIMIT dispositivos diferentes (por defeito: 2) — o suficiente
// para cobrir reinstalações da app ou troca de telemóvel, mas continua a
// impedir que o mesmo código seja partilhado livremente por muitas pessoas.
//
// Podes ajustar o limite criando a variável de ambiente DEVICE_LIMIT no
// Netlify (ex: "3"). Sem essa variável, o limite por defeito é 2.
//
// Requer a dependência "@netlify/blobs".

const MAX_DISPOSITIVOS = parseInt(process.env.DEVICE_LIMIT || '2', 10);

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
    const store = getStore({
      name: 'essencia-codigos',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN
    });

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

    // Migração automática de registos antigos (campo único "dispositivo")
    if (!Array.isArray(registo.dispositivos)) {
      registo.dispositivos = registo.dispositivo ? [registo.dispositivo] : [];
    }

    // Este dispositivo já está autorizado para este código — entra normalmente
    if (registo.dispositivos.includes(dispositivo)) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valido: true })
      };
    }

    // Dispositivo novo — há lugar disponível dentro do limite permitido
    if (registo.dispositivos.length < MAX_DISPOSITIVOS) {
      registo.dispositivos.push(dispositivo);
      if (!registo.activadoEm) registo.activadoEm = new Date().toISOString();
      registo.ultimaActivacaoEm = new Date().toISOString();
      await store.setJSON(codigoLimpo, registo);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valido: true })
      };
    }

    // Limite de dispositivos atingido — bloqueado
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valido: false,
        erro: 'Este código já atingiu o número máximo de dispositivos permitidos. Se precisares de ajuda, contacta-nos por email.'
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
