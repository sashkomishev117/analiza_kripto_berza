import React, { useState, useEffect } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import List from './pages/List'
import Detail from './pages/Detail'

export default function App() {
  const [coins, setCoins] = useState([])
  useEffect(() => {
    fetch('http://localhost:4000/api/coins')
      .then(r => r.json())
      .then(setCoins)
      .catch(() => setCoins([]))
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <header>
        <h1>Crypto Analysis Prototype</h1>
        <nav>
          <Link to="/">Home</Link> | <Link to="/list">List</Link>
        </nav>
      </header>

      <Routes>
        <Route path='/' element={<Home coins={coins} />} />
        <Route path='/list' element={<List coins={coins} />} />
        <Route path="/coins/:id" element={<Detail />} />
      </Routes>
    </div>
  )
}