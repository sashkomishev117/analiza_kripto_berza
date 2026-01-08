import React, { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import List from './pages/List'
import Detail from './pages/Detail'
import Analytics from './pages/Analytics'
import './styles/Nav.css'

function Layout({ coins }) {
  const location = useLocation()
  const path = location.pathname

  return (
    <>
      <header className="nav-root">
        <div className="nav-inner">
          <div>
            <div className="nav-title">Crypto Analytics</div>
            <div className="nav-sub">Dashboard &amp; Analytics</div>
          </div>
          <nav className="nav-links">
            <Link
              to="/"
              className={
                path === '/' ? 'nav-link nav-link-active' : 'nav-link'
              }
            >
              Dashboard
            </Link>
            <Link
              to="/list"
              className={
                path === '/list' ? 'nav-link nav-link-active' : 'nav-link'
              }
            >
              List
            </Link>
            <Link
              to="/analytics"
              className={
                path === '/analytics'
                  ? 'nav-link nav-link-active'
                  : 'nav-link'
              }
            >
              Analytics
            </Link>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home coins={coins} />} />
        <Route path="/list" element={<List coins={coins} />} />
        <Route path="/coins/:id" element={<Detail />} />
        <Route path="/analytics" element={<Analytics coins={coins} />} />
      </Routes>
    </>
  )
}

export default function App() {
  const [coins, setCoins] = useState([])

  useEffect(() => {
    fetch('/api/coins')
      .then(r => r.json())
      .then(setCoins)
      .catch(() => setCoins([]))
  }, [])

  return <Layout coins={coins} />
}
