// netlify/functions/validate-code.js
//
// Valida um código de acesso da Essência e regista o dispositivo.
// Lê/escreve no ficheiro codigos.json do repositório GitHub.
//
// Variáveis de ambiente necessárias:
//   GITHUB_TOKEN  — Personal Access Token do GitHub com permissão "repo"
//   GITHUB_REPO   — dono/repositório, ex: tatecheramil/essenciaa

const CODIGOS_FILE = 'codigos.json';
const MAX_DISPOSITIVOS = 2;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erro: 'Method not allowed' }) };
  }

  try {
    const { codigo, deviceId } = JSON.parse(event.body || '{}');
    if (!codigo || !deviceId) {
      return { statusCode: 400, body: JSON.stringify({ valido: false, erro: 'Parâmetros em falta.' }) };
    }

    const codigoUpper = String(codigo).trim().toUpperCase();

    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
      return { statusCode: 500, body: JSON.stringify({ valido: false, erro: 'Configuração do servidor em falta.' }) };
    }

    const apiBase = `https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/${CODIGOS_FILE}`;
    const headers = {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Essencia-App'
    };

    // Ler códigos do GitHub
    const getRes = await fetch(apiBase, { headers });
    if (!getRes.ok) {
      return { statusCode: 500, body: JSON.stringify({ valido: false, erro: 'Não foi possível verificar o código.' }) };
    }

    const fileInfo = await getRes.json();
    const sha = fileInfo.sha;
    const decoded = Buffer.from(fileInfo.content, 'base64').toString('utf-8');
    const codigos = JSON.parse(decoded);

    const entrada = codigos[codigoUpper];
    if (!entrada) {
      return { statusCode: 200, body: JSON.stringify({ valido: false, erro: 'Código inválido ou não encontrado.' }) };
    }

    const dispositivos = entrada.dispositivos || [];

    // Já registado neste dispositivo?
    if (dispositivos.includes(deviceId)) {
      return { statusCode: 200, body: JSON.stringify({ valido: true }) };
    }

    // Limite de dispositivos atingido?
    if (dispositivos.length >= MAX_DISPOSITIVOS) {
      return { statusCode: 200, body: JSON.stringify({ valido: false, erro: 'Limite de dispositivos atingido para este código.' }) };
    }

    // Registar dispositivo
    entrada.dispositivos = [...dispositivos, deviceId];
    if (!entrada.activadoEm) entrada.activadoEm = new Date().toISOString();
    codigos[codigoUpper] = entrada;

    // Guardar no GitHub
    const putBody = {
      message: `Activar código ${codigoUpper} — dispositivo ${deviceId.slice(0, 8)}`,
      content: Buffer.from(JSON.stringify(codigos, null, 2)).toString('base64'),
      sha
    };

    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers,
      body: JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      // Mesmo que não consiga guardar, aceitar o código (melhor que bloquear o cliente)
      console.error('Erro ao actualizar GitHub:', await putRes.text());
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valido: true })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ valido: false, erro: e.message }) };
  }
};
