const fs = require('fs')
const path = require('path')
const db = require('./db')

const CSV_PATH = path.join(__dirname, '..', 'data', 'top_1000_full.csv')

function parseCSV() {
    const raw = fs.readFileSync(CSV_PATH, 'utf8')
    const lines = raw.trim().split('\n')
    const headers = lines[0].split(',')

    return lines.slice(1).map(line => {
        const values = line.split(',')
        const obj = {}
        headers.forEach((h, i) => {
            obj[h] = values[i]
        })
        return obj
    })
}

function main() {
    const rows = parseCSV()

    const insert = db.prepare(`
      INSERT INTO ohlcv (
        coin_id, symbol, name, date,
        current_price, market_cap_x, total_volume
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const tx = db.transaction(data => {
        for (const r of data) {
            insert.run(
                r.id,
                r.symbol,
                r.name,
                r.date,                 // или некој фиксен датум ако го немаш
                Number(r.current_price),
                Number(r.market_cap_x), // ОВА е промената
                Number(r.total_volume)
            )
        }
    })

    tx(rows)
    console.log('Import done:', rows.length)
}

main()
