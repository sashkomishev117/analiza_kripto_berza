const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = path.join(__dirname, '..', 'data', 'crypto.db')
const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS ohlcv (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_id TEXT,
    symbol TEXT,
    name TEXT,
    date TEXT,
    current_price REAL,
    market_cap_x REAL,
    high_24h REAL,
    low_24h REAL,
    total_volume REAL
  );
`)

module.exports = db
