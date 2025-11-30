import React from 'react'
import { Link } from 'react-router-dom'

export default function Home({ coins }) {
  return (
    <div>
      <h2>Welcome</h2>
      <p>Quick snapshot of coins:</p>
      <ul>
        {coins.slice(0,5).map(c => (
          <li key={c.id}>
            <Link to={`/coins/${c.id}`}> {c.name} ({c.symbol.toUpperCase()}) - {c.current_price} </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}