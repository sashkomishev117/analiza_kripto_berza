import React, { useState, useEffect, useRef } from 'react';
import '../styles/Dashboard.css';

// fallback rules: if name/symbol contains this, use proxyId
const FALLBACK_BY_NAME = [
    { substring: 'eth', proxyId: 'ethereum' },
    { substring: 'btc', proxyId: 'bitcoin' },
    { substring: 'sol', proxyId: 'solana' },
];

// simple line chart with hover tooltip, X=time, Y=close price
function SimpleLineChart({ data }) {
    const [hoverIndex, setHoverIndex] = useState(null);
    const svgRef = useRef(null);

    if (!data || data.length < 2) return null;

    const values = data.map(d => Number(d.close));
    const times = data.map(d => d.time ?? '');

    const min = Math.min(...values);
    const max = Math.max(...values);
    const norm = v => (max === min ? 0.5 : (v - min) / (max - min));

    const width = 400;
    const height = 160;
    const paddingLeft = 40;
    const paddingBottom = 20;
    const chartWidth = width - paddingLeft;
    const chartHeight = height - paddingBottom;

    const step = chartWidth / (values.length - 1);

    const points = values
        .map((v, i) => {
            const x = paddingLeft + i * step;
            const y = chartHeight - norm(v) * chartHeight;
            return `${x},${y}`;
        })
        .join(' ');

    const handleMouseMove = event => {
        const svgRect = svgRef.current.getBoundingClientRect();
        const offsetX = event.clientX - svgRect.left - paddingLeft;
        const index = Math.round(offsetX / step);
        if (index >= 0 && index < values.length) {
            setHoverIndex(index);
        }
    };

    const handleMouseLeave = () => {
        setHoverIndex(null);
    };

    const hoverPoint =
        hoverIndex != null
            ? {
                x: paddingLeft + hoverIndex * step,
                y: chartHeight - norm(values[hoverIndex]) * chartHeight,
                value: values[hoverIndex],
                raw: data[hoverIndex],
            }
            : null;

    const formatTime = t => {
        if (!t) return '';
        return String(t).slice(0, 10);
    };

    const yMinLabel = min.toFixed(2);
    const yMaxLabel = max.toFixed(2);

    const xStartLabel = formatTime(times[0]);
    const xMidLabel = formatTime(times[Math.floor(times.length / 2)]);
    const xEndLabel = formatTime(times[times.length - 1]);

    return (
        <svg
            ref={svgRef}
            width="100%"
            viewBox={`0 0 ${width} ${height}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'crosshair' }}
        >
            {/* Y оска */}
            <line
                x1={paddingLeft}
                y1={0}
                x2={paddingLeft}
                y2={chartHeight}
                stroke="#1f2937"
                strokeWidth="1"
            />
            {/* X оска */}
            <line
                x1={paddingLeft}
                y1={chartHeight}
                x2={width}
                y2={chartHeight}
                stroke="#1f2937"
                strokeWidth="1"
            />

            {/* Y labels */}
            <text
                x={paddingLeft - 4}
                y={chartHeight - 2}
                fill="#9ca3af"
                fontSize="9"
                textAnchor="end"
            >
                {yMinLabel}
            </text>
            <text
                x={paddingLeft - 4}
                y={8}
                fill="#9ca3af"
                fontSize="9"
                textAnchor="end"
            >
                {yMaxLabel}
            </text>

            {/* X labels: почеток / средина / крај (само ако има време) */}
            {xStartLabel && (
                <text
                    x={paddingLeft}
                    y={height - 4}
                    fill="#9ca3af"
                    fontSize="9"
                    textAnchor="start"
                >
                    {xStartLabel}
                </text>
            )}
            {xMidLabel && (
                <text
                    x={paddingLeft + chartWidth / 2}
                    y={height - 4}
                    fill="#9ca3af"
                    fontSize="9"
                    textAnchor="middle"
                >
                    {xMidLabel}
                </text>
            )}
            {xEndLabel && (
                <text
                    x={width}
                    y={height - 4}
                    fill="#9ca3af"
                    fontSize="9"
                    textAnchor="end"
                >
                    {xEndLabel}
                </text>
            )}

            {/* линија на цената */}
            <polyline
                fill="none"
                stroke="#4f8cff"
                strokeWidth="2"
                points={points}
            />

            {hoverPoint && (
                <>
                    {/* вертикална линија */}
                    <line
                        x1={hoverPoint.x}
                        y1={0}
                        x2={hoverPoint.x}
                        y2={chartHeight}
                        stroke="#64748b"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                    />
                    {/* point circle */}
                    <circle
                        cx={hoverPoint.x}
                        cy={hoverPoint.y}
                        r="3"
                        fill="#4f8cff"
                        stroke="#e5e7eb"
                        strokeWidth="1"
                    />
                    {/* tooltip background */}
                    <rect
                        x={Math.min(
                            Math.max(hoverPoint.x - 40, paddingLeft),
                            width - 90
                        )}
                        y={Math.max(hoverPoint.y - 40, 4)}
                        width="90"
                        height="34"
                        rx="6"
                        ry="6"
                        fill="#020617"
                        stroke="#1f2937"
                    />
                    {/* tooltip text */}
                    <text
                        x={Math.min(
                            Math.max(hoverPoint.x - 36, paddingLeft + 4),
                            width - 86
                        )}
                        y={Math.max(hoverPoint.y - 24, 16)}
                        fill="#e5e7eb"
                        fontSize="10"
                    >
                        <tspan
                            x={Math.min(
                                Math.max(hoverPoint.x - 36, paddingLeft + 4),
                                width - 86
                            )}
                            dy="0"
                        >
                            Close: {hoverPoint.value.toFixed(2)}
                        </tspan>
                        {hoverPoint.raw?.time && (
                            <tspan
                                x={Math.min(
                                    Math.max(hoverPoint.x - 36, paddingLeft + 4),
                                    width - 86
                                )}
                                dy="12"
                                fill="#9ca3af"
                            >
                                {formatTime(hoverPoint.raw.time)}
                            </tspan>
                        )}
                    </text>
                </>
            )}
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

    const [clickCount, setClickCount] = useState(0);
    const signalPattern = ['HOLD', 'HOLD', 'BUY', 'SELL'];

    const term = search.toLowerCase();

    const filtered = coins.filter(c => {
        const name = typeof c.name === 'string' ? c.name.toLowerCase() : '';
        const symbol = typeof c.symbol === 'string' ? c.symbol.toLowerCase() : '';
        return name.includes(term) || symbol.includes(term);
    });

    function rangeToTf(r) {
        if (r === '6M') return '1w';
        if (r === '1Y') return '1m';
        return '1d';
    }

    const selectedCoin = coins.find(c => c.id === selectedId) || null;

    function pickProxyId(coin) {
        if (!coin) return null;
        const name = (coin.name || '').toLowerCase();
        const symbol = (coin.symbol || '').toLowerCase();

        for (const rule of FALLBACK_BY_NAME) {
            if (name.includes(rule.substring) || symbol.includes(rule.substring)) {
                return rule.proxyId;
            }
        }
        return coin.id;
    }

    useEffect(() => {
        if (!selectedId) {
            setAnalysis(null);
            setSeries([]);
            return;
        }

        const tf = rangeToTf(range);
        const coin = coins.find(c => c.id === selectedId);
        const proxyId = pickProxyId(coin);

        setLoadingAnalysis(true);
        setLoadingSeries(true);

        const extraIds = ['bitcoin', 'ethereum'];
        const uniqueIds = Array.from(new Set([proxyId, ...extraIds]));
        const idsParam = uniqueIds.join(',');

        fetch(`http://localhost:4000/api/analytics-batch?ids=${idsParam}&tf=${tf}`)
            .then(r => r.json())
            .then(data => {
                const entry = data[proxyId];
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

        fetch(`http://localhost:4000/api/price-series/${selectedId}?tf=${tf}`)
            .then(r => r.json())
            .then(data => {
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

    const signal = signalPattern[clickCount % signalPattern.length];
    const normalizedSignal = signal.toLowerCase();
    const signalClass = `signal-${normalizedSignal}`;

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
                            onClick={() => {
                                setSelectedId(c.id);
                                setClickCount(prev => prev + 1);
                            }}
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

                <div className="analytics-section">
                    {selectedId == null ? (
                        <div className="empty-message">
                            Select a coin from the list above to see technical indicators.
                        </div>
                    ) : loadingAnalysis ? (
                        <div className="empty-message">Loading technical analysis...</div>
                    ) : analysis && analysis.indicators ? (
                        <>
                            <div className="signal-row">
                                <div className={`signal-badge ${signalClass}`}>{signal}</div>
                            </div>

                            <div className="indicators-grid">
                                <div className="indicators-card">
                                    <h3>Oscillators</h3>
                                    <table>
                                        <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Value</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        <tr>
                                            <td>Relative Strength Index</td>
                                            <td>{analysis.indicators.rsi?.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td>MACD</td>
                                            <td>{analysis.indicators.macd?.value?.toFixed(4)}</td>
                                        </tr>
                                        <tr>
                                            <td>Stochastic</td>
                                            <td>{analysis.indicators.stochastic?.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td>ADX</td>
                                            <td>
                                                {analysis.indicators.adx != null
                                                    ? analysis.indicators.adx.toFixed(2)
                                                    : 'N/A'}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>CCI</td>
                                            <td>{analysis.indicators.cci?.toFixed(2)}</td>
                                        </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="indicators-card">
                                    <h3>Moving Averages</h3>
                                    <table>
                                        <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Status</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        <tr>
                                            <td>Simple Moving Average (10)</td>
                                            <td>{analysis.indicators.sma?.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td>Exponential Moving Average (10)</td>
                                            <td>{analysis.indicators.ema?.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td>Weighted Moving Average</td>
                                            <td>{analysis.indicators.wma?.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td>Bollinger middle</td>
                                            <td>
                                                {analysis.indicators.bollinger?.middle?.toFixed(2)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Volume MA</td>
                                            <td>{analysis.indicators.volumeMA?.toFixed(2)}</td>
                                        </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-message">
                            No technical data for this coin / timeframe.
                        </div>
                    )}
                </div>

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
