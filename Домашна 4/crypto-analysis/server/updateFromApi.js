// server/updateFromApi.js
const db = require('./db');
const fetch = (...args) =>
    import('node-fetch').then(({ default: f }) => f(...args));

// helper: fetch with retry за API грешки
async function fetchWithRetry(url, attempts = 3, delayMs = 1500) {
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return res;

            console.error('markets API error', res.status, 'try', i + 1, 'for', url);
            if (res.status === 429 || res.status >= 500) {
                await new Promise(r => setTimeout(r, delayMs));
                continue;
            }
            break;
        } catch (e) {
            console.error('markets network error try', i + 1, 'for', url, e.message);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return null;
}

async function fetchTop1000() {
    const perPage = 250;
    const pages = [1, 2, 3, 4]; // 4 x 250 = 1000
    const all = [];

    for (const p of pages) {
        const url =
            `https://api.coingecko.com/api/v3/coins/markets` +
            `?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${p}&sparkline=false`;

        const res = await fetchWithRetry(url);
        if (!res) {
            console.error('markets API failed after retries, page', p);
            continue;
        }

        const data = await res.json();
        if (Array.isArray(data)) {
            all.push(...data);
        }
        await new Promise(r => setTimeout(r, 1200)); // мал delay за rate‑limit
    }
    return all;
}

async function updateTopCoins() {
    console.log('Updating TOP 1000 list...');
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
            // интегритет: валиден id и бројки
            if (!c.id || c.market_cap == null) continue;
            if (
                !Number.isFinite(Number(c.current_price)) ||
                !Number.isFinite(Number(c.total_volume)) ||
                !Number.isFinite(Number(c.market_cap))
            ) {
                continue;
            }
            upsert.run(c);
        }
    });

    tx(coins);
    console.log('TOP 1000 updated:', coins.length);
}

module.exports = { updateTopCoins };
