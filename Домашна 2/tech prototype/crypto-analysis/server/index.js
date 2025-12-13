const express = require('express')
const path = require('path')
const fs = require('fs')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const CSV_PATH = path.join(__dirname, '..', 'data', 'top_1000_full.csv')

// Convert CSV → JSON
function parseCSV() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8')

  const lines = raw.trim().split('\n')
  const headers = lines[0].split(',')

  const data = lines.slice(1).map(line => {
    const values = line.split(',')
    const obj = {}
    headers.forEach((h, i) => {
      let value = values[i]

      // try to convert numbers
      if (!isNaN(value) && value.trim() !== "") {
        value = Number(value)
      }

      obj[h] = value
    })
    return obj
  })

  return data
}

// API: all coins
app.get('/api/coins', (req, res) => {
  res.json(parseCSV())
})

// API: single coin
app.get('/api/coins/:id', (req, res) => {
  const id = req.params.id
  const coins = parseCSV()
  const coin = coins.find(c => String(c.id) === id)

  if (!coin) return res.status(404).json({ error: 'Not found' })
  res.json(coin)
})

// Serve built frontend
const staticPath = path.join(__dirname, '..', 'dist', 'prototype-das')
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'))
  })
}

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`))
