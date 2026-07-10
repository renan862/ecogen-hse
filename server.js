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


// Rota POST para enviar o certificado em PDF para o Telegram
app.post('/api/send-telegram', async (req, res) => {
  try {
    const { pdfBase64, filename, name, cpf, company, sector, dateTime, verificationCode } = req.body;

    if (!pdfBase64 || !filename) {
      return res.status(400).json({ status: 'error', message: 'PDF ausente.' });
    }

    if (TELEGRAM_BOT_TOKEN === 'SUA_TOKEN_DO_TELEGRAM_AQUI') {
      console.warn('[Telegram] Token do bot não configurado. Ignorando envio.');
      return res.json({ status: 'warning', message: 'Token do bot do Telegram não está configurado.' });
    }

    // Converte a string base64 do PDF em um buffer binário
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Cria o objeto File do Fetch API para envio como documento
    const file = new File([pdfBuffer], filename, { type: 'application/pdf' });

    // Mensagem formatada em Markdown para o Telegram
    const caption = `🔔 *Integração HSE Concluída*\n\n` +
                    `👤 *Nome:* ${name}\n` +
                    `🪪 *CPF:* ${cpf}\n` +
                    `🏢 *Empresa:* ${company}\n` +
                    `🏭 *Setor Responsável:* ${sector}\n` +
                    `📅 *Concluído em:* ${dateTime}\n` +
                    `🔑 *Cód. Verificação:* ${verificationCode}`;

    // Constrói o FormData para envio multipart/form-data
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('document', file);
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');

    console.log(`[Telegram] Enviando documento do certificado para o chat ${TELEGRAM_CHAT_ID}...`);

    const telegramRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const telegramData = await telegramRes.json();

    if (!telegramRes.ok || !telegramData.ok) {
      console.error('[Telegram] Erro retornado pela API do Telegram:', telegramData);
      return res.status(500).json({ status: 'error', message: 'Falha no envio para o Telegram.', details: telegramData });
    }

    console.log(`[Telegram] Certificado de ${name} enviado com sucesso.`);
    res.json({ status: 'success', message: 'Certificado enviado com sucesso.' });
  } catch (error) {
    console.error('[Telegram] Erro interno ao processar envio:', error);
    res.status(500).json({ status: 'error', message: 'Erro interno no servidor ao enviar documento.' });
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
