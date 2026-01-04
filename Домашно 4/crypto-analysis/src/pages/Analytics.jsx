import React, { useState, useEffect } from 'react';
import '../styles/Dashboard.css';

// fallback правила: ако name/symbol го содржи ова, користи proxyId
const FALLBACK_BY_NAME = [
  { substring: 'eth', proxyId: 'ethereum' },
  { substring: 'btc', proxyId: 'bitcoin' },
  { substring: 'sol', proxyId: 'solana' },
];

// едноставен line chart
function SimpleLineChart({ data }) {
  if (!data || data.length < 2) return null;

  const values = data.map(d => Number(d.close));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const norm = v => (max === min ? 0.5 : (v - min) / (max - min));

  const width = 400;
  const height = 160;
  const step = width / (values.length - 1);

  const points = values
      .map((v, i) => {
        const x = i * step;
        const y = height - norm(v) * height;
        return `${x},${y}`;
      })
      .join(' ');

  return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        <polyline
            fill="none"
            stroke="#4f8cff"
            strokeWidth="2"
            points={points}
        />
      </svg>
  );
}

export default function Analytics({ coins = [] }) {
  const [metric, setMetric] = useState('price');
  const [range, setRange] = useState('3M'); // 3M -> 1d, 6M -> 1w, 1Y -> 1m
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const [analysis, setAnalysis] = useState(null);
  const [series, setSeries] = useState([]);

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);

  const term = search.toLowerCase();

  const filtered = coins.filter(c => {
    const name = typeof c.name === 'string' ? c.name.toLowerCase() : '';
    const symbol = typeof c.symbol === 'string' ? c.symbol.toLowerCase() : '';
    return name.includes(term) || symbol.includes(term);
  });

  // мапирање од UI range во tf параметар
  function rangeToTf(r) {
    if (r === '6M') return '1w';
    if (r === '1Y') return '1m';
    return '1d'; // 3M
  }

  const selectedCoin = coins.find(c => c.id === selectedId) || null;

  // одреди proxyId за техничка анализа ако за нов коин нема свои податоци
  function pickProxyId(coin) {
    if (!coin) return null;
    const name = (coin.name || '').toLowerCase();
    const symbol = (coin.symbol || '').toLowerCase();

    for (const rule of FALLBACK_BY_NAME) {
      if (name.includes(rule.substring) || symbol.includes(rule.substring)) {
        return rule.proxyId;
      }
    }
    return coin.id; // default: самата монета
  }

  useEffect(() => {
    if (!selectedId) {
      setAnalysis(null);
      setSeries([]);
      return;
    }

    const tf = rangeToTf(range);
    const coin = coins.find(c => c.id === selectedId);
    const proxyId = pickProxyId(coin); // може да биде ethereum/bitcoin/solana

    setLoadingAnalysis(true);
    setLoadingSeries(true);

    // избраниот (proxy) коин + уште два примери
    const extraIds = ['bitcoin', 'ethereum'];
    const uniqueIds = Array.from(new Set([proxyId, ...extraIds]));
    const idsParam = uniqueIds.join(',');

    // индикатори
    fetch(`http://localhost:4000/api/analytics-batch?ids=${idsParam}&tf=${tf}`)
        .then(r => r.json())
        .then(data => {
          console.log('Batch analytics:', data);
          const entry = data[proxyId]; // важно: користиме proxyId
          if (!entry || !entry.indicators) {
            setAnalysis(null);
          } else {
            setAnalysis(entry);
          }
        })
        .catch(err => {
          console.error('Analytics fetch error:', err);
          setAnalysis(null);
        })
        .finally(() => setLoadingAnalysis(false));

    // серија за график – можеш да користиш selectedId (реален коин)
    fetch(`http://localhost:4000/api/price-series/${selectedId}?tf=${tf}`)
        .then(r => r.json())
        .then(data => {
          console.log('Price series:', data);
          if (Array.isArray(data) && data.length > 1) {
            setSeries(data);
          } else {
            setSeries([]);
          }
        })
        .catch(err => {
          console.error('Price series fetch error:', err);
          setSeries([]);
        })
        .finally(() => setLoadingSeries(false));
  }, [selectedId, range, coins]);

  return (
      <div className="page">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Analytics</h2>
              <p className="card-sub">
                Technical indicators and signals for selected coin
              </p>
            </div>
          </div>

          <div className="filter-bar">
            <input
                className="filter-input"
                placeholder="Search coins..."
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
              <option value="3M">1 day (short)</option>
              <option value="6M">1 week (medium)</option>
              <option value="1Y">1 month (long)</option>
            </select>
          </div>

          {/* листа на монети за избор */}
          <div
              className="table-wrapper"
              style={{ maxHeight: 200, overflowY: 'auto' }}
          >
            {filtered.map(c => (
                <div
                    key={c.id}
                    className={`row-item ${
                        selectedId === c.id ? 'row-selected' : ''
                    }`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedId(c.id)}
                >
              <span>
                {c.name} ({c.symbol})
              </span>
                  <span>
                {metric === 'price'
                    ? c.current_price
                    : metric === 'market_cap_x'
                        ? c.market_cap
                        : c.total_volume}
              </span>
                </div>
            ))}
          </div>

          {/* приказ на индикаторите */}
          <div
              className="table-wrapper"
              style={{ marginTop: 16, padding: 12 }}
          >
            {selectedId == null ? (
                <div className="empty-message">
                  Select a coin from the list above to see technical indicators.
                </div>
            ) : loadingAnalysis ? (
                <div className="empty-message">Loading technical analysis...</div>
            ) : analysis && analysis.indicators ? (
                <div className="empty-message" style={{ textAlign: 'left' }}>
                  <h3>
                    {selectedCoin
                        ? `${selectedCoin.name} (${selectedCoin.symbol}) – Technical indicators`
                        : 'Technical indicators'}
                  </h3>

                  <p>Signal: {analysis.indicators.signal}</p>
                  <p>RSI: {analysis.indicators.rsi?.toFixed(2)}</p>
                  <p>MACD: {analysis.indicators.macd?.value?.toFixed(4)}</p>
                  <p>Stochastic: {analysis.indicators.stochastic?.toFixed(2)}</p>
                  <p>
                    ADX{' '}
                    {analysis.indicators.adx != null
                        ? analysis.indicators.adx.toFixed(2)
                        : 'N/A'}
                  </p>
                  <p>CCI: {analysis.indicators.cci?.toFixed(2)}</p>
                  <p>SMA: {analysis.indicators.sma?.toFixed(2)}</p>
                  <p>EMA: {analysis.indicators.ema?.toFixed(2)}</p>
                  <p>WMA: {analysis.indicators.wma?.toFixed(2)}</p>
                  <p>
                    Bollinger middle{' '}
                    {analysis.indicators.bollinger?.middle?.toFixed(2)}
                  </p>
                  <p>Volume MA: {analysis.indicators.volumeMA?.toFixed(2)}</p>
                </div>
            ) : (
                <div className="empty-message">
                  No technical data for this coin / timeframe.
                </div>
            )}
          </div>

          {/* график на цената */}
          <div
              className="table-wrapper"
              style={{ marginTop: 16, padding: 12 }}
          >
            {selectedId == null ? (
                <div className="empty-message">
                  Select a coin to see its price chart.
                </div>
            ) : loadingSeries ? (
                <div className="empty-message">Loading price chart...</div>
            ) : series && series.length > 1 ? (
                <div className="empty-message" style={{ textAlign: 'left' }}>
                  <h3>
                    {selectedCoin
                        ? `${selectedCoin.name} (${selectedCoin.symbol}) – Price chart`
                        : 'Price chart'}
                  </h3>
                  <SimpleLineChart data={series} />
                </div>
            ) : (
                <div className="empty-message">
                  No price history for this coin / timeframe.
                </div>
            )}
          </div>
        </div>
      </div>
  );
}
