import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Dashboard.css';

export default function List({ coins = [] }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('market_cap');
  const [sortDir, setSortDir] = useState('desc');
  const [minCap, setMinCap] = useState('');
  const [minVolume, setMinVolume] = useState('');
  const [minChange24, setMinChange24] = useState(''); // NEW

  console.log('List coins length:', coins.length);

  // Deduplicate by symbol
  const uniqueCoins = Object.values(
      coins.reduce((acc, coin) => {
        const key = coin.symbol || coin.name || coin.id;
        if (!acc[key]) acc[key] = coin;
        return acc;
      }, {})
  );

  const term = String(search || '').toLowerCase();

  const filteredCoins = uniqueCoins
      .filter(
          coin =>
              coin.current_price != null &&
              coin.market_cap != null &&
              coin.total_volume != null
      )
      .filter(coin => {
        const name =
            typeof coin.name === 'string' ? coin.name.toLowerCase() : '';
        const symbol =
            typeof coin.symbol === 'string' ? coin.symbol.toLowerCase() : '';
        return name.includes(term) || symbol.includes(term);
      })
      .filter(coin => {
        if (!minCap) return true;
        const cap = Number(minCap);
        if (Number.isNaN(cap)) return true;
        return Number(coin.market_cap || 0) >= cap;
      })
      .filter(coin => {
        if (!minVolume) return true;
        const vol = Number(minVolume);
        if (Number.isNaN(vol)) return true;
        return Number(coin.total_volume || 0) >= vol;
      })
      .filter(coin => {
        // NEW: филтер по 24h промена
        if (!minChange24) return true;
        const ch = Number(minChange24);
        if (Number.isNaN(ch)) return true;
        return Number(coin.change_24h || 0) >= ch;
      })
      .sort((a, b) => {
        const aVal = Number(a[sortBy] || 0);
        const bVal = Number(b[sortBy] || 0);
        const diff = bVal - aVal;
        return sortDir === 'desc' ? diff : -diff;
      });

  return (
      <div className="page">
        <div className="card">
          {/* header */}
          <div className="card-header">
            <div>
              <h2 className="card-title">Crypto Analytics Dashboard</h2>
              <p className="card-sub">Market overview</p>
            </div>
            <div>
              <span className="card-sub">Currency </span>
              <button className="filter-select">USD</button>
            </div>
          </div>

          {/* filter bar */}
          <div className="filter-bar">
            <input
                className="filter-input"
                placeholder="Search by symbol or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
            <select
                className="filter-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
            >
              <option value="market_cap">Sort by Market Cap</option>
              <option value="current_price">Sort by Price</option>
              <option value="total_volume">Sort by Volume 24h</option>
              <option value="change_24h">Sort by Change 24h %</option>
            </select>
            <select
                className="filter-select"
                value={sortDir}
                onChange={e => setSortDir(e.target.value)}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <input
                className="filter-select"
                placeholder="Min Market Cap"
                type="number"
                value={minCap}
                onChange={e => setMinCap(e.target.value)}
            />
            <input
                className="filter-select"
                placeholder="Min Volume"
                type="number"
                value={minVolume}
                onChange={e => setMinVolume(e.target.value)}
            />
            <input
                className="filter-select"
                placeholder="Min 24h change %"
                type="number"
                value={minChange24}
                onChange={e => setMinChange24(e.target.value)}
            />
          </div>

          {/* table */}
          <div className="table-wrapper">
            <table className="coin-table">
              <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th className="text-right">Price</th>
                <th className="text-right">Market Cap</th>
                <th className="text-right">Volume 24h</th>
                <th className="text-right">Change 24h %</th> {/* NEW */}
              </tr>
              </thead>
              <tbody>
              {filteredCoins.map((coin, index) => (
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
                      ${Number(coin.market_cap).toLocaleString()}
                    </td>
                    <td className="text-right">
                      ${Number(coin.total_volume).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {coin.change_24h != null
                          ? `${coin.change_24h.toFixed(2)}%`
                          : 'N/A'}
                    </td>
                  </tr>
              ))}
              </tbody>
            </table>
            {filteredCoins.length === 0 && (
                <div className="empty-message">No coins match your filters.</div>
            )}
          </div>
        </div>
      </div>
  );
}
