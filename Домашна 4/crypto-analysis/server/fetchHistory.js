// server/fetchHistory.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fetch = (...args) =>
    import('node-fetch').then(({ default: f }) => f(...args));

const dbPath = path.join(__dirname, '..', 'data', 'crypto.db');
const db = new sqlite3.Database(dbPath);

// 1. Создај табела за историски OHLCV
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS ohlcv_candles (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      coin_id TEXT    NOT NULL,
      ts      INTEGER NOT NULL,
      open    REAL    NOT NULL,
      high    REAL    NOT NULL,
      low     REAL    NOT NULL,
      close   REAL    NOT NULL,
      volume  REAL    NOT NULL
    )
  `);
    db.run(`
    CREATE INDEX IF NOT EXISTS idx_ohlcv_candles_coin_ts
      ON ohlcv_candles(coin_id, ts DESC)
  `);
});

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function fetchHistoryForCoin(coinId) {
    console.log(`Fetching history for ${coinId} ...`);

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=90`;
    const res = await fetch(url);
    if (!res.ok) {
        console.error('CoinGecko error', res.status, 'for', coinId);
        return 0;
    }

    /** candles: [ [ts, open, high, low, close], ... ] */
    const candles = await res.json();

    const insert = db.prepare(`
    INSERT INTO ohlcv_candles (coin_id, ts, open, high, low, close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        for (const [ts, o, h, l, c] of candles) {
            insert.run(coinId, ts, o, h, l, c, 0); // volume = 0 (нема во овој endpoint)
        }
        db.run('COMMIT');
    });

    insert.finalize();
    console.log(`Inserted ${candles.length} candles for ${coinId}`);
    return candles.length;
}

async function main() {
    // 2. земи ги сите coin_id од постоечката ohlcv табела
    const coins = await all(`SELECT DISTINCT coin_id FROM ohlcv`);
    const ids = coins.map(c => c.coin_id);

    let total = 0;
    for (const id of ids) {
        try {
            const n = await fetchHistoryForCoin(id);
            total += n;
            // мал паузер да не удриш rate limit
            await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
            console.error('Error for', id, e.message);
        }
    }

    console.log('DONE, total candles inserted:', total);
    db.close();
}

main().catch(err => {
    console.error(err);
    db.close();
});
