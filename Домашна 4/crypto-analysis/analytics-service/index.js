const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const { computeIndicators } = require('./indicators');

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'crypto.db');
const db = new Database(DB_PATH);

// ensure tables exist (за да не пука ако не се креирани уште)
db.exec(`
  CREATE TABLE IF NOT EXISTS ohlcv (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_id TEXT UNIQUE,
    symbol TEXT,
    name TEXT,
    date TEXT,
    current_price REAL,
    market_cap_x REAL,
    high_24h REAL,
    low_24h REAL,
    total_volume REAL,
    change_24h REAL,
    change_7d REAL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS ohlcv_candles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ohlcv_candles_coin_ts
    ON ohlcv_candles(coin_id, ts DESC);
`);

// tf -> limit
function tfToLimit(tf) {
  if (tf === '1w') return 30;
  if (tf === '1m') return 90;
  return 10;
}

// fake bars ако нема историски податоци
function makeFakeBars(id, tf) {
  const limit = tfToLimit(tf);
  const row = db.prepare(`SELECT current_price FROM ohlcv WHERE coin_id = ? LIMIT 1`).get(id);
  const price = row ? Number(row.current_price) || 0 : 0;

  return Array.from({ length: limit }, (_, i) => {
    const tweak = (i % 7 - 3) * 0.004;
    const close = price * (1 + tweak);
    return {
      date: i,
      open: close,
      high: close * 1.002,
      low: close * 0.998,
      close,
      volume: 0
    };
  });
}

app.get('/health', (req, res) => res.json({ ok: true }));

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
    SELECT ts AS date, open, high, low, close, volume
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

// Price series (за график)
app.get('/api/price-series/:id', (req, res) => {
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

  res.json(rows);
});

const PORT = process.env.PORT || 8082;
app.listen(PORT, () => console.log(`analytics-service running on http://localhost:${PORT}`));
