const fs = require('fs');
const path = require('path');

// Caminho para o ficheiro de códigos
const CODIGOS_PATH = path.join(__dirname, '../../codigos.json');

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ erro: 'Método não permitido' }) };
  }

  try {
    const { codigo, dispositivo } = JSON.parse(event.body);

    if (!codigo || !dispositivo) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ valido: false, erro: 'Código ou dispositivo em falta' })
      };
    }

    const codigoNormalizado = codigo.trim().toUpperCase();

    // Ler ficheiro de códigos
    let codigos;
    try {
      const raw = fs.readFileSync(CODIGOS_PATH, 'utf8');
      codigos = JSON.parse(raw);
    } catch(e) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ valido: false, erro: 'Erro interno ao ler códigos' })
      };
    }

    // Verificar se o código existe
    if (!(codigoNormalizado in codigos)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ valido: false, erro: 'Código inválido' })
      };
    }

    const entrada = codigos[codigoNormalizado];

    // Se já foi usado por outro dispositivo
    if (entrada.usado && entrada.dispositivo !== dispositivo) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ valido: false, erro: 'Código já utilizado noutro dispositivo' })
      };
    }

    // Válido — marcar como usado por este dispositivo
    codigos[codigoNormalizado] = {
      usado: true,
      dispositivo: dispositivo
    };

    fs.writeFileSync(CODIGOS_PATH, JSON.stringify(codigos, null, 2));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ valido: true })
    };

  } catch(e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ valido: false, erro: 'Erro interno: ' + e.message })
    };
  }
};
