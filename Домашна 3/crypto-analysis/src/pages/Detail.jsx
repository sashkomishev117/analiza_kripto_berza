import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import '../styles/Dashboard.css'

export default function Detail() {
  const { id } = useParams()
  const [coin, setCoin] = useState(null)

  useEffect(() => {
    fetch(`http://localhost:4000/api/coins/${id}`)
      .then(r => r.json())
      .then(setCoin)
      .catch(() => setCoin(null))
  }, [id])

  if (!coin) return <div className="page"><div className="card">Loading...</div></div>

  const fmt = v => v != null ? Number(v).toLocaleString() : '-'

  return (
    <div className="page">
      <div className="card">
        <h2 className="card-title">
          {coin.name} ({coin.symbol?.toUpperCase()})
        </h2>
        <p className="card-sub">ID: {coin.id}</p>

        <div className="table-wrapper" style={{ marginTop: 16 }}>
          <table className="coin-table">
            <tbody>
              <tr>
                <th>Current price</th>
                <td>${fmt(coin.current_price)}</td>
              </tr>
              <tr>
                <th>Market cap X</th>
                <td>${fmt(coin.market_cap_x)}</td>
              </tr>
              <tr>
                <th>Market cap Y</th>
                <td>${fmt(coin.market_cap_y)}</td>
              </tr>
              <tr>
                <th>High 24h</th>
                <td>${fmt(coin.high_24h)}</td>
              </tr>
              <tr>
                <th>Low 24h</th>
                <td>${fmt(coin.low_24h)}</td>
              </tr>
              <tr>
                <th>Total volume</th>
                <td>${fmt(coin.total_volume)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
