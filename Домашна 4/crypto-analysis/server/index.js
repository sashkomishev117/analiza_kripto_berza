const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const db = require('./db'); // Assumes db.js exports a 'pg' Pool
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
  try {
    // Get all coins
    const { rows: coins } = await db.query(`SELECT DISTINCT coin_id FROM ohlcv`);

    const selectCandlesSql = `
      SELECT ts, close
      FROM ohlcv_candles
      WHERE coin_id = $1
      ORDER BY ts DESC
      LIMIT 8
    `;

    const updateSql = `
      UPDATE ohlcv
      SET change_24h = $1, change_7d = $2
      WHERE coin_id = $3
    `;

    for (const c of coins) {
      const { rows } = await db.query(selectCandlesSql, [c.coin_id]);

      if (rows.length < 2) continue;

      const today = Number(rows[0].close);
      const yesterday = Number(rows[1].close);

      let change24 = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : null;

      let change7 = null;
      if (rows.length >= 7) {
        const sevenAgo = Number(rows[6].close);
        change7 = sevenAgo > 0 ? ((today - sevenAgo) / sevenAgo) * 100 : null;
      }

      await db.query(updateSql, [change24, change7, c.coin_id]);
    }
    console.log(`Recomputed changes for ${coins.length} coins`);
  } catch (err) {
    console.error('Error recomputing changes:', err);
  }
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
app.get('/api/coins', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT coin_id as id,
             symbol,
             name,
             current_price,
             market_cap_x as market_cap,
             total_volume,
             change_24h,
             change_7d
      FROM ohlcv
      GROUP BY coin_id, symbol, name, current_price, market_cap_x, total_volume, change_24h, change_7d
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed to fetch coins' });
  }
});

// Еден coin
app.get('/api/coins/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM ohlcv WHERE coin_id = $1 LIMIT 1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Analytics за еден coin
app.get('/api/analytics/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const tf = req.query.tf || '1d';
    const limit = tfToLimit(tf);

    const { rows } = await db.query(`
      SELECT ts AS date, open, high, low, close, volume
      FROM ohlcv_candles
      WHERE coin_id = $1
      ORDER BY ts DESC
      LIMIT $2
    `, [id, limit]);

    let bars = rows.reverse();

    if (!bars.length) bars = makeFakeBars(id, tf);

    const indicators = computeIndicators(bars, tf);
    res.json({ id, timeFrame: tf, indicators });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Analytics error' });
  }
});

// Batch analytics
app.get('/api/analytics-batch', async (req, res) => {
  try {
    const idsParam = req.query.ids;
    const tf = req.query.tf || '1d';
    if (!idsParam) return res.status(400).json({ error: 'ids query param required' });

    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    const limit = tfToLimit(tf);

    const sql = `
      SELECT coin_id, ts AS date, open, high, low, close, volume
      FROM ohlcv_candles
      WHERE coin_id = $1
      ORDER BY ts DESC
      LIMIT $2
    `;

    const result = {};
    for (const id of ids) {
      const { rows } = await db.query(sql, [id, limit]);
      let bars = rows.reverse();

      if (!bars.length) bars = makeFakeBars(id, tf);

      result[id] = { timeFrame: tf, indicators: computeIndicators(bars, tf) };
    }

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Batch analytics error' });
  }
});

// Price series за график
app.get('/api/price-series/:id', async (req, res) => {
  try {
    const start = Date.now();
    const id = req.params.id;
    const tf = req.query.tf || '1d';
    const limit = tfToLimit(tf);

    const { rows } = await db.query(`
      SELECT ts AS date, close
      FROM ohlcv_candles
      WHERE coin_id = $1
      ORDER BY ts DESC
      LIMIT $2
    `, [id, limit]);

    let data = rows.reverse();

    if (!data.length) {
      data = makeFakeBars(id, tf).map(b => ({ date: b.date, close: b.close }));
    }

    console.log('price-series', id, tf, 'took', Date.now() - start, 'ms');
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Price series error' });
  }
});

// EXPORT CSV (Filesystem based - no DB changes needed)
const CSV_PATH = path.join(__dirname, '..', 'data', 'top_1000_full.csv');
function parseCSV() {
  try {
    const raw = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = raw.trim().split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => (obj[h] = values[i]));
      return obj;
    });
  } catch (e) {
    console.error('CSV read error:', e);
    return [];
  }
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
