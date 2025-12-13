const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const db = require('./db');
const { computeIndicators } = require('./indicators');

const app = express();
app.use(cors());
app.use(express.json());

// Помошна функција: мапира tf во limit (број дневни свеќи)
function tfToLimit(tf) {
  if (tf === '1w') return 30;   // 1 недела -> 30 барови
  if (tf === '1m') return 90;   // 1 месец -> 90 барови
  return 10;                    // 1 ден -> 10 барови
}

// помошна: создај „лажни“ барови околу моменталната цена
function makeFakeBars(id, tf) {
  const limit = tfToLimit(tf);
  const row = db.prepare(
      `SELECT current_price FROM ohlcv WHERE coin_id = ? LIMIT 1`
  ).get(id);

  const price = row ? Number(row.current_price) || 0 : 0;

  const fakeBars = Array.from({ length: limit }, (_, i) => {
    const tweak = (i % 7 - 3) * 0.004; // околу ±0.8%
    const close = price * (1 + tweak);
    return {
      date: i,
      open: close,
      high: close * 1.002,
      low: close * 0.998,
      close,
      volume: 0,
    };
  });

  return fakeBars;
}

function makeFakeSeries(id, tf) {
  const limit = tfToLimit(tf);
  const row = db.prepare(
      `SELECT current_price FROM ohlcv WHERE coin_id = ? LIMIT 1`
  ).get(id);

  const price = row ? Number(row.current_price) || 0 : 0;

  return Array.from({ length: limit }, (_, i) => {
    const tweak = (i % 7 - 3) * 0.004;
    const close = price * (1 + tweak);
    return { date: i, close };
  });
}

// ===================== API ROUTES =====================

// GET /api/coins -> листа од база (моментални цени)
app.get('/api/coins', (req, res) => {
  const rows = db.prepare(`
    SELECT coin_id as id,
           symbol,
           name,
           current_price,
           market_cap_x as market_cap,
           total_volume
    FROM ohlcv
    GROUP BY coin_id
  `).all();
  res.json(rows);
});

// GET /api/coins/:id -> еден coin од база
app.get('/api/coins/:id', (req, res) => {
  const id = req.params.id;
  const row = db.prepare(`
    SELECT *
    FROM ohlcv
    WHERE coin_id = ?
    LIMIT 1
  `).get(id);

  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(row);
});

// GET /api/analytics/:id?tf=1d|1w|1m -> техничка анализа за еден coin
app.get('/api/analytics/:id', (req, res) => {
  const id = req.params.id;
  const tf = req.query.tf || '1d';

  const limit = tfToLimit(tf);

  let bars = db.prepare(`
    SELECT
      ts    AS date,
      open,
      high,
      low,
      close,
      volume
    FROM ohlcv_candles
    WHERE coin_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(id, limit).reverse(); // најстар -> најнов

  console.log('bars length for', id, 'tf', tf, ':', bars.length);

  if (!bars.length) {
    // нема историја -> користи synthetic серија од моменталната цена
    bars = makeFakeBars(id, tf);
  }

  const indicators = computeIndicators(bars, tf);
  res.json({ id, timeFrame: tf, indicators });
});

// GET /api/analytics-batch?ids=bitcoin,ethereum&tf=1d
app.get('/api/analytics-batch', (req, res) => {
  const idsParam = req.query.ids;
  const tf = req.query.tf || '1d';

  if (!idsParam) {
    return res.status(400).json({ error: 'ids query param required' });
  }

  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  const limit = tfToLimit(tf);

  const stmt = db.prepare(`
    SELECT
      coin_id,
      ts    AS date,
      open,
      high,
      low,
      close,
      volume
    FROM ohlcv_candles
    WHERE coin_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `);

  const result = {};

  for (const id of ids) {
    let bars = stmt.all(id, limit).reverse();
    if (!bars.length) {
      bars = makeFakeBars(id, tf);
    }
    result[id] = {
      timeFrame: tf,
      indicators: computeIndicators(bars, tf),
    };
  }

  res.json(result);
});

// NEW: серија на цени за график
// GET /api/price-series/:id?tf=1d|1w|1m
app.get('/api/price-series/:id', (req, res) => {
  const id = req.params.id;
  const tf = req.query.tf || '1d';

  const limit = tfToLimit(tf);

  let rows = db.prepare(`
    SELECT
      ts    AS date,
      close
    FROM ohlcv_candles
    WHERE coin_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(id, limit).reverse();

  if (!rows.length) {
    // нема серија -> synthetic серија околу моменталната цена
    rows = makeFakeSeries(id, tf);
    return res.json(rows);
  }

  // козметичка варијација (по желба)
  rows = rows.map((r, i) => {
    const base = Number(r.close) || 0;
    const tweak = (i % 7 - 3) * 0.004; // околу ±0.8%
    return {
      ...r,
      close: base * (1 + tweak),
    };
  });

  res.json(rows);
});

/**
 * GET /api/export/:id?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
const CSV_PATH = path.join(__dirname, '..', 'data', 'top_1000_full.csv');

function parseCSV() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i];
    });
    return obj;
  });
}

app.get('/api/export/:id', (req, res) => {
  const id = req.params.id;
  const { from, to } = req.query;
  const data = parseCSV();

  let rows = data.filter(r => String(r.id) === String(id));
  if (from) rows = rows.filter(r => r.date >= from);
  if (to) rows = rows.filter(r => r.date <= to);

  if (!rows.length) {
    return res.status(404).json({ error: 'No data for export' });
  }

  const headers = Object.keys(rows[0]);
  const lines = [];
  lines.push(headers.join(','));
  for (const row of rows) {
    lines.push(headers.map(h => row[h]).join(','));
  }
  const csv = lines.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${id}.csv"`);
  res.send(csv);
});

// ===================== STATIC FRONTEND =====================

const staticPath = path.join(__dirname, '..', 'dist', 'prototype-das');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// ===================== START SERVER =====================

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
