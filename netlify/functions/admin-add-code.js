// netlify/functions/admin-add-code.js
//
// Versão reescrita SEM Netlify Blobs — usa GitHub API para guardar os códigos
// directamente no repositório, num ficheiro JSON (codigos.json).
//
// Variáveis de ambiente necessárias no Netlify:
//   ADMIN_SECRET      — a tua palavra-passe secreta (já existia)
//   GITHUB_TOKEN      — Personal Access Token do GitHub com permissão "repo"
//   GITHUB_REPO       — dono/repositório, ex: tatecheramil/essenciaa
//
// Como usar:
//   curl --ssl-no-revoke -X POST https://appessencia.netlify.app/.netlify/functions/admin-add-code \
//     -H "Content-Type: application/json" \
//     -d "{\"segredo\":\"A_TUA_PALAVRA_PASSE\"}"
//
// Resposta: {"sucesso":true,"codigo":"ESS-AB12-CD34-EF56"}

const CODIGOS_FILE = 'codigos.json'; // ficheiro no raiz do repositório

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erro: 'Method not allowed' }) };
  }

  try {
    const { segredo, codigo } = JSON.parse(event.body || '{}');

    // Verificar segredo
    if (!process.env.ADMIN_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ erro: 'ADMIN_SECRET não configurado.' }) };
    }
    if (!segredo || segredo !== process.env.ADMIN_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ erro: 'Não autorizado.' }) };
    }

    // Verificar variáveis GitHub
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
      return { statusCode: 500, body: JSON.stringify({ erro: 'GITHUB_TOKEN ou GITHUB_REPO não configurados.' }) };
    }

    const apiBase = `https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/${CODIGOS_FILE}`;
    const headers = {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Essencia-App'
    };

    // Ler ficheiro actual (ou criar vazio)
    let currentData = {};
    let sha = null;
    try {
      const getRes = await fetch(apiBase, { headers });
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        sha = fileInfo.sha;
        const decoded = Buffer.from(fileInfo.content, 'base64').toString('utf-8');
        currentData = JSON.parse(decoded);
      }
    } catch (e) {
      currentData = {};
    }

    // Gerar ou usar código fornecido
    const codigoFinal = codigo ? String(codigo).trim().toUpperCase() : gerarCodigo();
    if (!/^ESS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigoFinal)) {
      return { statusCode: 400, body: JSON.stringify({ erro: 'Formato de código inválido.' }) };
    }
    if (currentData[codigoFinal]) {
      return { statusCode: 409, body: JSON.stringify({ erro: 'Este código já existe.' }) };
    }

    // Adicionar novo código
    currentData[codigoFinal] = {
      dispositivos: [],
      criadoEm: new Date().toISOString(),
      activadoEm: null
    };

    // Guardar no GitHub
    const body = {
      message: `Adicionar código ${codigoFinal}`,
      content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
      ...(sha ? { sha } : {})
    };

    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      return { statusCode: 500, body: JSON.stringify({ erro: 'Erro ao guardar no GitHub: ' + (err.message || putRes.status) }) };
    }

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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function bloco() {
    let s = '';
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  return 'ESS-' + bloco() + '-' + bloco() + '-' + bloco();
}
