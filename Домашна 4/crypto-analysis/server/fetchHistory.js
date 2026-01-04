// server/fetchHistory.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fetch = (...args) =>
    import('node-fetch').then(({ default: f }) => f(...args));

const dbPath = path.join(__dirname, '..', 'data', 'crypto.db');
const db = new sqlite3.Database(dbPath);

// 1. Табела за историски OHLCV
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

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}

// ===== helper: fetch with retry (за API грешки 429/5xx) =====
async function fetchWithRetry(url, attempts = 3, delayMs = 1500) {
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return res;

            console.error('API error', res.status, 'try', i + 1, 'for', url);
            if (res.status === 429 || res.status >= 500) {
                // кратка пауза и повторен обид
                await new Promise(r => setTimeout(r, delayMs));
                continue;
            }
            // за други статуси нема смисла retry
            break;
        } catch (e) {
            console.error('Network error try', i + 1, 'for', url, e.message);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return null;
}

async function fetchDailyHistoryRange(coinId, fromTs, toTs) {
    const url =
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range` +
        `?vs_currency=usd&from=${fromTs}&to=${toTs}`;

    const res = await fetchWithRetry(url);
    if (!res) {
        console.error('CoinGecko range failed after retries for', coinId);
        return [];
    }

    const data = await res.json(); // { prices: [[ts, price]...], total_volumes: [[ts, vol]...] }

    const prices = Array.isArray(data.prices) ? data.prices : [];
    const volumes = Array.isArray(data.total_volumes) ? data.total_volumes : [];

    const byDay = new Map();

    for (const [tsMsRaw, priceRaw] of prices) {
        const tsMs = Number(tsMsRaw);
        const price = Number(priceRaw);
        if (!Number.isFinite(tsMs) || !Number.isFinite(price)) continue; // заштита од лош формат

        const day = Math.floor(tsMs / 86400000);
        const rec = byDay.get(day) || {
            ts: tsMs,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
        };
        rec.high = Math.max(rec.high, price);
        rec.low = Math.min(rec.low, price);
        rec.close = price;
        byDay.set(day, rec);
    }

    for (const [tsMsRaw, volRaw] of volumes) {
        const tsMs = Number(tsMsRaw);
        const vol = Number(volRaw);
        if (!Number.isFinite(tsMs) || !Number.isFinite(vol)) continue;

        const day = Math.floor(tsMs / 86400000);
        const rec = byDay.get(day);
        if (rec) rec.volume += vol;
    }

    return [...byDay.values()].sort((a, b) => a.ts - b.ts);
}

async function fetchHistoryForCoin(coinId) {
    console.log(`Fetching history for ${coinId} ...`);

    const row = await get(
        `SELECT ts FROM ohlcv_candles WHERE coin_id = ? ORDER BY ts DESC LIMIT 1`,
        [coinId]
    );

    const nowSec = Math.floor(Date.now() / 1000);
    const tenYearsSec = 10 * 365 * 24 * 60 * 60;

    let fromSec;
    if (row && row.ts) {
        fromSec = Math.floor(row.ts / 1000) + 24 * 60 * 60;
    } else {
        fromSec = nowSec - tenYearsSec;
    }

    if (fromSec >= nowSec) {
        console.log('No missing days for', coinId);
        return 0;
    }

    const candles = await fetchDailyHistoryRange(coinId, fromSec, nowSec);

    if (!candles.length) {
        console.log('No new candles for', coinId);
        return 0;
    }

    const insert = db.prepare(`
    INSERT INTO ohlcv_candles (coin_id, ts, open, high, low, close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        for (const c of candles) {
            // дополнителна проверка за интегритет
            if (
                !Number.isFinite(c.ts) ||
                !Number.isFinite(c.open) ||
                !Number.isFinite(c.high) ||
                !Number.isFinite(c.low) ||
                !Number.isFinite(c.close)
            ) {
                continue;
            }
            insert.run(
                coinId,
                c.ts,
                c.open,
                c.high,
                c.low,
                c.close,
                Number.isFinite(c.volume) ? c.volume : 0
            );
        }
        db.run('COMMIT');
    });

    insert.finalize();
    console.log(`Inserted ${candles.length} candles for ${coinId}`);
    return candles.length;
}

async function main() {
    console.time('initial-fill'); // START measure

    const coins = await all(`SELECT DISTINCT coin_id FROM ohlcv`);
    const ids = coins.map(c => c.coin_id);

    let total = 0;
    for (const id of ids) {
        try {
            const n = await fetchHistoryForCoin(id);
            total += n;
            await new Promise(r => setTimeout(r, 1500)); // мала пауза – rate limit
        } catch (e) {
            console.error('Error for', id, e.message);
        }
    }

    console.log('DONE, total candles inserted:', total);
    console.timeEnd('initial-fill'); // END measure
    db.close();
}

main().catch(err => {
    console.error(err);
    db.close();
});
