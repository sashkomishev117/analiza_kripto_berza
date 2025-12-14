const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'crypto.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, rows) => {
    if (err) throw err;
    console.log('Tables:', rows);

    rows.forEach(r => {
        const name = r.name;
        db.all(`PRAGMA table_info(${name});`, [], (err2, cols) => {
            if (err2) throw err2;
            console.log(`\nSchema for ${name}:`);
            console.table(cols);
        });
    });
});
