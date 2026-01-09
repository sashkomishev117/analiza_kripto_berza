const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Create tables
pool.query(`
  CREATE TABLE IF NOT EXISTS ohlcv (
    id SERIAL PRIMARY KEY,
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

  CREATE TABLE IF NOT EXISTS ohlcv_candles (
    id SERIAL PRIMARY KEY,
    coin_id TEXT,
    ts BIGINT,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume REAL,
    UNIQUE(coin_id, ts)
  );
`).catch(console.error);

module.exports = pool;
