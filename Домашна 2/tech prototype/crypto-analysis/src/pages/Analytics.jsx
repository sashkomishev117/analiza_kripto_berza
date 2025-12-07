import React, { useState } from 'react'
import '../styles/Dashboard.css'

export default function Analytics({ coins = [] }) {
  const [metric, setMetric] = useState('price')
  const [range, setRange] = useState('3M')
  const [search, setSearch] = useState('')

  const term = search.toLowerCase()

  const filtered = coins.filter(c => {
    const name =
      typeof c.name === 'string' ? c.name.toLowerCase() : ''
    const symbol =
      typeof c.symbol === 'string' ? c.symbol.toLowerCase() : ''
    return name.includes(term) || symbol.includes(term)
  })

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Analytics</h2>
            <p className="card-sub">
              Compare selected cryptocurrencies over time
            </p>
          </div>
        </div>

        <div className="filter-bar">
          <input
            className="filter-input"
            placeholder="Search coins to add..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={metric}
            onChange={e => setMetric(e.target.value)}
          >
            <option value="price">Price</option>
            <option value="market_cap_x">Market Cap</option>
            <option value="total_volume">Volume</option>
          </select>
          <select
            className="filter-select"
            value={range}
            onChange={e => setRange(e.target.value)}
          >
            <option value="3M">3M</option>
            <option value="6M">6M</option>
            <option value="1Y">1Y</option>
          </select>
        </div>

        <div className="table-wrapper" style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="empty-message">
            Chart placeholder – {filtered.length} coins match current search.
          </div>
        </div>
      </div>
    </div>
  )
}
