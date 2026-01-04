const db = require('./db')
const fetch = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args))

async function updatePrices() {
    const coins = db.prepare(`
    SELECT DISTINCT coin_id
    FROM ohlcv
  `).all()

    const ids = coins.map(c => c.coin_id)
    const batchSize = 100
    const stmt = db.prepare(`
    UPDATE ohlcv
    SET current_price = ?,
        market_cap_x  = ?,
        total_volume  = ?
    WHERE coin_id = ?
  `)

    let totalUpdated = 0

    for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize).join(',')
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${batchIds}`

        const res = await fetch(url)
        if (!res.ok) {
            console.error('API error:', res.status)
            continue
        }
        const data = await res.json()

        const tx = db.transaction(rows => {
            for (const row of rows) {
                stmt.run(
                    row.current_price,
                    row.market_cap,
                    row.total_volume,
                    row.id
                )
            }
        })

        tx(data)
        totalUpdated += data.length
        console.log(`Batch updated: ${data.length}`)
    }

    console.log('Total updated:', totalUpdated)
}

updatePrices().catch(console.error)
