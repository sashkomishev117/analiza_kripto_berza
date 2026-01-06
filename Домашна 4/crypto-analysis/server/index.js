const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const db = require('./db');
const {
  marketUpdater,
  computeIndicators,
  tfToLimit,
  makeFakeBars,
} = require('./services/CryptoFacade');
const { updateTopCoins } = require('./updateFromApi');

const app = express();
app.use(cors());
app.use(express.json());

// ===================== PROMENI 24h / 7d =====================
async function recomputeAllChanges() {
  const coins = db.prepare(`SELECT DISTINCT coin_id FROM ohlcv`).all();
  const selectCandles = db.prepare(`
    SELECT ts, close
    FROM ohlcv_candles
    WHERE coin_id = ?
    ORDER BY ts DESC
    LIMIT 8
  `);
  const updateStmt = db.prepare(`
    UPDATE ohlcv
    SET change_24h = ?, change_7d = ?
    WHERE coin_id = ?
  `);

  for (const c of coins) {
    const rows = selectCandles.all(c.coin_id);
    if (rows.length < 2) continue;

    const today = Number(rows[0].close);
    const yesterday = Number(rows[1].close);

    let change24 = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : null;

    let change7 = null;
    if (rows.length >= 7) {
      const sevenAgo = Number(rows[6].close);
      change7 = sevenAgo > 0 ? ((today - sevenAgo) / sevenAgo) * 100 : null;
    }

    updateStmt.run(change24, change7, c.coin_id);
  }
  console.log(`Recomputed changes for ${coins.length} coins`);
}

// ===================== API ROUTES =====================

// Ручно ажурирање на TOP coins
app.post('/api/update-coins', async (req, res) => {
  try {
    await updateTopCoins();
    await recomputeAllChanges();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'update failed' });
  }
});

// Ручно пресметка на промени
app.post('/api/recompute-changes', async (req, res) => {
  try {
    await recomputeAllChanges();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed to recompute changes' });
  }
});

// Листа на сите coins
app.get('/api/coins', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT coin_id as id,
             symbol,
             name,
             current_price,
             market_cap_x as market_cap,
             total_volume,
             change_24h,
             change_7d
      FROM ohlcv
      GROUP BY coin_id
    `).all();
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed to fetch coins' });
  }
});

// Еден coin
app.get('/api/coins/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM ohlcv WHERE coin_id = ? LIMIT 1`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Analytics за еден coin
app.get('/api/analytics/:id', (req, res) => {
  const id = req.params.id;
  const tf = req.query.tf || '1d';
  const limit = tfToLimit(tf);

  let bars = db.prepare(`
    SELECT ts AS date, open, high, low, close, volume
    FROM ohlcv_candles
    WHERE coin_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(id, limit).reverse();

  if (!bars.length) bars = makeFakeBars(id, tf);

  const indicators = computeIndicators(bars, tf);
  res.json({ id, timeFrame: tf, indicators });
});

// Batch analytics
app.get('/api/analytics-batch', (req, res) => {
  const idsParam = req.query.ids;
  const tf = req.query.tf || '1d';
  if (!idsParam) return res.status(400).json({ error: 'ids query param required' });

  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  const limit = tfToLimit(tf);

  const stmt = db.prepare(`
    SELECT coin_id, ts AS date, open, high, low, close, volume
    FROM ohlcv_candles
    WHERE coin_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `);

  const result = {};
  for (const id of ids) {
    let bars = stmt.all(id, limit).reverse();
    if (!bars.length) bars = makeFakeBars(id, tf);
    result[id] = { timeFrame: tf, indicators: computeIndicators(bars, tf) };
  }

  res.json(result);
});

// Price series за график
app.get('/api/price-series/:id', (req, res) => {
  const start = Date.now();
  const id = req.params.id;
  const tf = req.query.tf || '1d';
  const limit = tfToLimit(tf);

  let rows = db.prepare(`
    SELECT ts AS date, close
    FROM ohlcv_candles
    WHERE coin_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(id, limit).reverse();

  if (!rows.length) rows = makeFakeBars(id, tf).map(b => ({ date: b.date, close: b.close }));

  console.log('price-series', id, tf, 'took', Date.now() - start, 'ms');
  res.json(rows);
});

// EXPORT CSV (опционално)
const CSV_PATH = path.join(__dirname, '..', 'data', 'top_1000_full.csv');
function parseCSV() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => (obj[h] = values[i]));
    return obj;
  });
}

app.get('/api/export/:id', (req, res) => {
  const id = req.params.id;
  const { from, to } = req.query;
  let rows = parseCSV().filter(r => String(r.id) === String(id));
  if (from) rows = rows.filter(r => r.date >= from);
  if (to) rows = rows.filter(r => r.date <= to);
  if (!rows.length) return res.status(404).json({ error: 'No data for export' });

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')].concat(rows.map(r => headers.map(h => r[h]).join(',')));
  const csv = lines.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${id}.csv"`);
  res.send(csv);
});

// STATIC FRONTEND
const staticPath = path.join(__dirname, '..', 'dist', 'prototype-das');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  app.get('*', (req, res) => res.sendFile(path.join(staticPath, 'index.html')));
}

// Авто-update на TOP coins секои 6 часа
setInterval(() => {
  updateTopCoins()
      .then(() => recomputeAllChanges())
      .catch(err => console.error('auto updateTopCoins error', err));
}, 6 * 60 * 60 * 1000);

// START SERVER
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
