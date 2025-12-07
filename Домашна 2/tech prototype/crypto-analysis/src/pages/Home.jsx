import React from 'react'
import { Link } from 'react-router-dom'
import '../styles/Dashboard.css'

export default function Home({ coins = [] }) {
  const topCoins = coins.slice(0, 5)

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Welcome</h2>
            <p className="card-sub">Quick snapshot of top coins</p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="coin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th className="text-right">Price</th>
                <th className="text-right">Market Cap</th>
              </tr>
            </thead>
            <tbody>
              {topCoins.map((coin, index) => (
                <tr key={coin.id}>
                  <td className="coin-rank">{index + 1}</td>
                  <td>
                    <Link
                      to={`/coins/${coin.id}`}
                      className="coin-name-link"
                    >
                      {coin.name}
                    </Link>
                    <div className="coin-symbol">{coin.symbol}</div>
                  </td>
                  <td className="text-right">
                    ${Number(coin.current_price).toLocaleString()}
                  </td>
                  <td className="text-right">
                    ${Number(coin.market_cap_x).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {topCoins.length === 0 && (
            <div className="empty-message">
              No data loaded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
