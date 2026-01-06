const MarketUpdater = require('../subjects/MarketUpdater');
const ChangeRecomputeObserver = require('../observers/ChangeRecomputeObserver');
const { updateTopCoins } = require('../updateFromApi');
const { computeIndicators } = require('../indicators');
const db = require('../db');

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
            volume: 0,
        };
    });
}

// recompute 24h/7d changes
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

// observer
const marketUpdater = new MarketUpdater(updateTopCoins);
marketUpdater.subscribe(new ChangeRecomputeObserver(recomputeAllChanges));

module.exports = {
    marketUpdater,
    computeIndicators,
    tfToLimit,
    makeFakeBars,
};
