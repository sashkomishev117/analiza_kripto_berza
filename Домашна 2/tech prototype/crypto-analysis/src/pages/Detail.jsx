import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

export default function Detail() {
  const { id } = useParams()
  const [coin, setCoin] = useState(null)

  useEffect(() => {
    fetch(`http://localhost:4000/api/coins/${id}`)
      .then(r => r.json())
      .then(setCoin)
  }, [id])

  if (!coin) return <div>Loading...</div>

  return (
    <div>
      <h2>
        {coin.name} ({coin.symbol.toUpperCase()})
      </h2>
      <p>Current price: {coin.current_price}</p>
      <p>Market cap X: {coin.market_cap_x}</p>
      <p>Market cap Y: {coin.market_cap_y}</p>
      <p>High 24h: {coin.high_24h}</p>
      <p>Low 24h: {coin.low_24h}</p>
      <p>Total volume: {coin.total_volume}</p>
      <p>Price change % 24h: {coin.price_change_percentage_24h}</p>
    </div>
  )
}
