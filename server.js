const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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
    verificationCode TEXT
  )
`);

// Middleware para processar JSON e requisições URL encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      verificationCode
    } = req.body;

    // Validação básica
    if (!name || !cpf || !company || !sector || !reason || !verificationCode) {
      return res.status(400).json({ status: 'error', message: 'Campos obrigatórios ausentes.' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO registrations (dateTime, name, cpf, company, emergency, sector, reason, verificationCode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      dateTime || new Date().toLocaleString('pt-BR'),
      name,
      cpf,
      company,
      emergency || '',
      sector,
      reason,
      verificationCode
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


// Inicia o servidor
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Servidor de Integração HSE rodando com sucesso!`);
  console.log(` Acesse: http://localhost:${PORT}`);
  console.log(` Painel Admin: http://localhost:${PORT}/admin.html`);
  console.log(`==================================================`);
});
