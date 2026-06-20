// netlify/functions/admin-add-code.js
//
// Função privada para TI usares depois de cada venda — regista um novo
// código válido (ainda não associado a nenhum dispositivo).
//
// Protegida por uma palavra-passe secreta que tu defines em
// Netlify → Site settings → Environment variables → ADMIN_SECRET
//
// Como usar (depois de configurares o ADMIN_SECRET no Netlify):
//
//   curl -X POST https://appessencia.netlify.app/.netlify/functions/admin-add-code \
//     -H "Content-Type: application/json" \
//     -d '{"segredo":"A_TUA_PALAVRA_PASSE_SECRETA"}'
//
// A resposta dá-te o código gerado, já pronto a copiar para o email do cliente:
//   {"sucesso":true,"codigo":"ESS-AB12-CD34-EF56"}
//
// Também podes pedir um código específico em vez de gerado automaticamente:
//   -d '{"segredo":"...", "codigo":"ESS-XXXX-XXXX-XXXX"}'

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erro: 'Method not allowed' }) };
  }

  try {
    const { segredo, codigo } = JSON.parse(event.body || '{}');

    if (!process.env.ADMIN_SECRET) {
      return {
        statusCode: 500,
        body: JSON.stringify({ erro: 'ADMIN_SECRET não está configurado no Netlify. Vê as instruções no topo deste ficheiro.' })
      };
    }

    if (!segredo || segredo !== process.env.ADMIN_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ erro: 'Não autorizado.' }) };
    }

    const { getStore } = require('@netlify/blobs');
    const store = getStore('essencia-codigos');

    let codigoFinal = codigo ? String(codigo).trim().toUpperCase() : gerarCodigo();

    if (!/^ESS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigoFinal)) {
      return { statusCode: 400, body: JSON.stringify({ erro: 'Formato de código inválido.' }) };
    }

    let existente = null;
    try {
      existente = await store.get(codigoFinal, { type: 'json' });
    } catch (e) {
      existente = null;
    }

    if (existente) {
      return { statusCode: 409, body: JSON.stringify({ erro: 'Este código já existe.' }) };
    }

    await store.setJSON(codigoFinal, {
      dispositivo: null,
      criadoEm: new Date().toISOString(),
      activadoEm: null
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sucesso: true, codigo: codigoFinal })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ erro: e.message }) };
  }
};

function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I para evitar confusão
  function bloco() {
    let s = '';
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  return 'ESS-' + bloco() + '-' + bloco() + '-' + bloco();
}
