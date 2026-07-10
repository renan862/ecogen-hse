const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Telegram (insira o token do bot aqui ou defina na variável de ambiente TELEGRAM_BOT_TOKEN)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'SUA_TOKEN_DO_TELEGRAM_AQUI';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1483383324';

// Inicializa o banco de dados SQLite
const db = new DatabaseSync(path.join(__dirname, 'database.db'));

// Cria a tabela de registros se não existir
db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dateTime TEXT,
    name TEXT,
    cpf TEXT,
    company TEXT,
    emergency TEXT,
    sector TEXT,
    reason TEXT,
    verificationCode TEXT,
    signature TEXT
  )
`);

// Tenta adicionar a coluna signature a bancos de dados existentes
try {
  db.exec(`ALTER TABLE registrations ADD COLUMN signature TEXT`);
} catch (e) {
  // Coluna já existe ou erro ignorado
}

// Middleware para processar JSON e requisições URL encoded com limite aumentado para PDFs grandes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir arquivos estáticos do diretório atual
app.use(express.static(__dirname));

// Rota POST para salvar o formulário de integração
app.post('/api/submit', (req, res) => {
  try {
    const {
      dateTime,
      name,
      cpf,
      company,
      emergency,
      sector,
      reason,
      verificationCode,
      signature
    } = req.body;

    // Validação básica
    if (!name || !cpf || !company || !sector || !reason || !verificationCode) {
      return res.status(400).json({ status: 'error', message: 'Campos obrigatórios ausentes.' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO registrations (dateTime, name, cpf, company, emergency, sector, reason, verificationCode, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      dateTime || new Date().toLocaleString('pt-BR'),
      name,
      cpf,
      company,
      emergency || '',
      sector,
      reason,
      verificationCode,
      signature || ''
    );

    console.log(`[Registro Salvo] Nome: ${name} | CPF: ${cpf} | Empresa: ${company}`);
    res.json({ status: 'success', message: 'Registro salvo com sucesso na base de dados SQLite.' });
  } catch (error) {
    console.error('Erro ao salvar no banco de dados:', error);
    res.status(500).json({ status: 'error', message: 'Erro interno no servidor ao salvar registro.' });
  }
});

// Rota GET para consultar os registros de integração
app.get('/api/registrations', (req, res) => {
  try {
    const { search, sector } = req.query;

    let query = 'SELECT * FROM registrations';
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(name LIKE ? OR cpf LIKE ? OR company LIKE ? OR verificationCode LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (sector) {
      conditions.push('sector = ?');
      params.push(sector);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    res.status(500).json({ status: 'error', message: 'Erro ao consultar banco de dados.' });
  }
});

// Rota GET para obter estatísticas do painel administrativo
app.get('/api/stats', (req, res) => {
  try {
    // Total Geral
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM registrations');
    const total = totalStmt.get().count;

    // Total de Hoje (data formatada como DD/MM/YYYY)
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const todayStmt = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE dateTime LIKE ?');
    const today = todayStmt.get(`${todayStr}%`).count;

    // Distribuição por Setor
    const sectorStmt = db.prepare('SELECT sector, COUNT(*) as count FROM registrations GROUP BY sector ORDER BY count DESC');
    const sectors = sectorStmt.all();

    // Distribuição por Tipo de Presença
    const reasonStmt = db.prepare('SELECT reason, COUNT(*) as count FROM registrations GROUP BY reason');
    const reasons = reasonStmt.all();

    res.json({
      total,
      today,
      sectors,
      reasons
    });
  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error);
    res.status(500).json({ status: 'error', message: 'Erro ao calcular estatísticas.' });
  }
});

// Rota DELETE para remover um registro
app.delete('/api/registrations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleteStmt = db.prepare('DELETE FROM registrations WHERE id = ?');
    deleteStmt.run(id);
    console.log(`[Registro Removido] ID: ${id}`);
    res.json({ status: 'success', message: 'Registro removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover registro:', error);
    res.status(500).json({ status: 'error', message: 'Erro ao remover registro do banco de dados.' });
  }
});


// Rota POST para enviar o certificado em Imagem (PNG) e PDF para o Telegram
app.post('/api/send-telegram', async (req, res) => {
  try {
    const { 
      pdfBase64, 
      pngBase64, 
      filenamePdf, 
      filenamePng, 
      name, 
      cpf, 
      company, 
      sector, 
      dateTime, 
      verificationCode 
    } = req.body;

    if (!pdfBase64 || !pngBase64 || !filenamePdf || !filenamePng) {
      return res.status(400).json({ status: 'error', message: 'PDF ou Imagem ausente.' });
    }

    if (TELEGRAM_BOT_TOKEN === 'SUA_TOKEN_DO_TELEGRAM_AQUI') {
      console.warn('[Telegram] Token do bot não configurado. Ignorando envio.');
      return res.json({ status: 'warning', message: 'Token do bot do Telegram não está configurado.' });
    }

    // Mensagem formatada em Markdown para o Telegram
    const caption = `🔔 *Integração HSE Concluída*\n\n` +
                    `👤 *Nome:* ${name}\n` +
                    `🪪 *CPF:* ${cpf}\n` +
                    `🏢 *Empresa:* ${company}\n` +
                    `🏭 *Setor Responsável:* ${sector}\n` +
                    `📅 *Concluído em:* ${dateTime}\n` +
                    `🔑 *Cód. Verificação:* ${verificationCode}`;

    // 1. Envia a imagem do certificado como Foto (com legenda)
    const photoBuffer = Buffer.from(pngBase64, 'base64');
    const photoFile = new File([photoBuffer], filenamePng, { type: 'image/png' });

    const photoFormData = new FormData();
    photoFormData.append('chat_id', TELEGRAM_CHAT_ID);
    photoFormData.append('photo', photoFile);
    photoFormData.append('caption', caption);
    photoFormData.append('parse_mode', 'Markdown');

    console.log(`[Telegram] Enviando imagem do certificado para o chat ${TELEGRAM_CHAT_ID}...`);
    const photoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: photoFormData
    });

    const photoData = await photoRes.json();
    if (!photoRes.ok || !photoData.ok) {
      console.error('[Telegram] Erro retornado pela API do Telegram (Photo):', photoData);
      return res.status(500).json({ status: 'error', message: 'Falha no envio da foto para o Telegram.', details: photoData });
    }

    // 2. Envia o documento PDF logo em seguida
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const pdfFile = new File([pdfBuffer], filenamePdf, { type: 'application/pdf' });

    const pdfFormData = new FormData();
    pdfFormData.append('chat_id', TELEGRAM_CHAT_ID);
    pdfFormData.append('document', pdfFile);

    console.log(`[Telegram] Enviando documento PDF para o chat ${TELEGRAM_CHAT_ID}...`);
    const pdfRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: pdfFormData
    });

    const pdfData = await pdfRes.json();
    if (!pdfRes.ok || !pdfData.ok) {
      console.error('[Telegram] Erro retornado pela API do Telegram (Document):', pdfData);
      return res.status(500).json({ status: 'error', message: 'Falha no envio do PDF para o Telegram.', details: pdfData });
    }

    console.log(`[Telegram] Imagem e PDF de ${name} enviados com sucesso.`);
    res.json({ status: 'success', message: 'Certificados enviados com sucesso.' });
  } catch (error) {
    console.error('[Telegram] Erro interno ao processar envio:', error);
    res.status(500).json({ status: 'error', message: 'Erro interno no servidor ao enviar certificado.' });
  }
});


// Inicia o servidor
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Servidor de Integração HSE rodando com sucesso!`);
  console.log(` Acesse: http://localhost:${PORT}`);
  console.log(` Painel Admin: http://localhost:${PORT}/admin.html`);
  console.log(`==================================================`);
});
