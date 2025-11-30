import React from 'react'
import { Link } from 'react-router-dom'

export default function List({ coins }) {
  return (
    <div>
      <h1>Top Coins</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Symbol</th>
            <th>Name</th>
            <th>Market Cap X</th>
            <th>Current Price</th>
            <th>High 24h</th>
            <th>Low 24h</th>
            <th>Total Volume</th>
            <th>Market Cap Y</th>
            <th>Price Change % 24h</th>
          </tr>
        </thead>
        <tbody>
          {coins.map(coin => (
            <tr key={coin.id}>
              <td>
                <Link to={`/coins/${coin.id}`}>{coin.id}</Link>
              </td>
              <td>{coin.symbol}</td>
              <td>{coin.name}</td>
              <td>{coin.market_cap_x}</td>
              <td>{coin.current_price}</td>
              <td>{coin.high_24h}</td>
              <td>{coin.low_24h}</td>
              <td>{coin.total_volume}</td>
              <td>{coin.market_cap_y}</td>
              <td>{coin.price_change_percentage_24h}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {coins.length === 0 && <p>No coins loaded yet.</p>}
    </div>
  )
}
