const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

// node-fetch v3 е ESM-only, затоа го обвиткуваме со dynamic import (исто како кај тебе)
const fetch = (...args) =>
  import('node-fetch').then(({ default: f }) => f(...args));

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'crypto.db');
const db = new Database(DB_PATH);

// ensure tables exist (ohlcv)
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

async function fetchWithRetry(url, attempts = 3, delayMs = 1500) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;

      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
}

async function fetchTop1000() {
  const perPage = 250;
  const pages = [1, 2, 3, 4];
  const all = [];

  for (const p of pages) {
    const url =
      `https://api.coingecko.com/api/v3/coins/markets` +
      `?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${p}&sparkline=false`;

    const res = await fetchWithRetry(url);
    if (!res) continue;

    const data = await res.json();
    if (Array.isArray(data)) all.push(...data);

    await new Promise(r => setTimeout(r, 1200));
  }
  return all;
}

async function updateTopCoins() {
  const coins = await fetchTop1000();

  const upsert = db.prepare(`
    INSERT INTO ohlcv (coin_id, symbol, name, date, current_price, market_cap_x, total_volume)
    VALUES (@id, @symbol, @name, DATE('now'), @current_price, @market_cap, @total_volume)
    ON CONFLICT(coin_id) DO UPDATE SET
      symbol        = excluded.symbol,
      name          = excluded.name,
      date          = excluded.date,
      current_price = excluded.current_price,
      market_cap_x  = excluded.market_cap_x,
      total_volume  = excluded.total_volume
  `);

  const tx = db.transaction(rows => {
    for (const c of rows) {
      if (!c.id || c.market_cap == null) continue;
      if (
        !Number.isFinite(Number(c.current_price)) ||
        !Number.isFinite(Number(c.total_volume)) ||
        !Number.isFinite(Number(c.market_cap))
      ) continue;

      upsert.run(c);
    }
  });

  tx(coins);
  return { insertedOrUpdated: coins.length };
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/coins', (req, res) => {
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
});

app.get('/api/coins/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM ohlcv WHERE coin_id = ? LIMIT 1`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// update coins (само ohlcv)
app.post('/api/update-coins', async (req, res) => {
  try {
    const result = await updateTopCoins();
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'update failed' });
  }
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => console.log(`coins-service running on http://localhost:${PORT}`));
