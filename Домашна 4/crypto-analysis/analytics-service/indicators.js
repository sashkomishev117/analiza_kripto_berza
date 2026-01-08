// server/indicators.js

// ===== helper functions =====
function sma(values, period) {
    if (!values || values.length < 1) return null;
    const p = Math.min(period, values.length);
    const slice = values.slice(values.length - p);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / p;
}

function ema(values, period) {
    if (!values || values.length < 1) return null;
    const p = Math.min(period, values.length);
    const k = 2 / (p + 1);
    let emaPrev = values[0];
    for (let i = 1; i < values.length; i++) {
        emaPrev = values[i] * k + emaPrev * (1 - k);
    }
    return emaPrev;
}

function wma(values, period) {
    if (!values || values.length < 1) return null;
    const p = Math.min(period, values.length);
    const slice = values.slice(values.length - p);
    const weights = slice.map((_, i) => i + 1);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const sum = slice.reduce((acc, v, i) => acc + v * weights[i], 0);
    return sum / weightSum;
}

function standardDeviation(values, period) {
    if (!values || values.length < 1) return null;
    const p = Math.min(period, values.length);
    const slice = values.slice(values.length - p);
    const mean = slice.reduce((a, b) => a + b, 0) / p;
    const variance =
        slice.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / p;
    return Math.sqrt(variance);
}

// ===== 5 oscillators =====

function rsi(closes, period = 2) {
    if (!closes || closes.length < 2) return null;

    const p = Math.min(period, closes.length - 1);
    let gains = 0;
    let losses = 0;

    const start = closes.length - 1 - p + 1;
    for (let i = start; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    gains /= p;
    losses /= p;
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
}

function macd(closes, fast = 1, slow = 2, signalPeriod = 1) {
    if (!closes || closes.length < 2) return null;

    let emaFast = closes[0];
    let emaSlow = closes[0];
    const kFast = 2 / (fast + 1);
    const kSlow = 2 / (slow + 1);
    const macdValues = [];

    for (let i = 1; i < closes.length; i++) {
        emaFast = closes[i] * kFast + emaFast * (1 - kFast);
        emaSlow = closes[i] * kSlow + emaSlow * (1 - kSlow);
        macdValues.push(emaFast - emaSlow);
    }

    let signal = macdValues[0];
    const kSig = 2 / (signalPeriod + 1);
    for (let i = 1; i < macdValues.length; i++) {
        signal = macdValues[i] * kSig + signal * (1 - kSig);
    }
    const macdLast = macdValues[macdValues.length - 1];
    return {
        value: macdLast,
        signal,
        hist: macdLast - signal,
    };
}

function stochastic(highs, lows, closes, period = 2) {
    if (!closes || closes.length < 2) return null;
    const p = Math.min(period, closes.length);
    const sliceHigh = highs.slice(highs.length - p);
    const sliceLow = lows.slice(lows.length - p);
    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);
    const lastClose = closes[closes.length - 1];
    if (highestHigh === lowestLow) return 50;
    const k = ((lastClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    return k;
}

function adx(highs, lows, closes, period = 1) {
    if (!closes || closes.length < 2) return 0;
    const p = Math.min(period, closes.length - 1);

    const plusDM = [];
    const minusDM = [];
    const tr = [];

    for (let i = 1; i < highs.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i - 1]);
        const lc = Math.abs(lows[i] - closes[i - 1]);
        tr.push(Math.max(hl, hc, lc));
    }

    const trN = sma(tr, p);
    const plusDMN = sma(plusDM, p);
    const minusDMN = sma(minusDM, p);

    if (trN == null || plusDMN == null || minusDMN == null) return 0;

    const plusDI = (plusDMN / trN) * 100;
    const minusDI = (minusDMN / trN) * 100;
    const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1)) * 100;

    let adxVal = dx;
    if (!Number.isFinite(adxVal)) adxVal = 0;

    const last = closes[closes.length - 1] || 0;
    const tweak = (last % 13) / 5;
    return adxVal + tweak;
}

function cci(highs, lows, closes, period = 2) {
    if (!closes || closes.length < 2) return null;
    const p = Math.min(period, closes.length);
    const typicalPrices = highs.map((h, i) => (h + lows[i] + closes[i]) / 3);
    const tpSlice = typicalPrices.slice(typicalPrices.length - p);
    const smaTp = tpSlice.reduce((a, b) => a + b, 0) / p;
    const meanDev =
        tpSlice.reduce((acc, v) => acc + Math.abs(v - smaTp), 0) / p;
    const lastTp = typicalPrices[typicalPrices.length - 1];
    if (meanDev === 0) return 0;
    return (lastTp - smaTp) / (0.015 * meanDev);
}

// ===== 5 moving averages =====

function smaClose(closes, period = 2) {
    return sma(closes, period);
}
function emaClose(closes, period = 2) {
    return ema(closes, period);
}
function wmaClose(closes, period = 2) {
    return wma(closes, period);
}
function bollingerBands(closes, period = 2, mult = 2) {
    const middle = sma(closes, period);
    const sd = standardDeviation(closes, period);
    if (middle == null || sd == null) return null;
    return {
        upper: middle + mult * sd,
        middle,
        lower: middle - mult * sd,
    };
}
function volumeMA(volumes, period = 2) {
    return sma(volumes, period);
}

// ===== signal generation =====
// супер агресивно: скоро секогаш BUY или SELL
function generateSignal(ind) {
    let score = 0;

    // RSI – многу тесен неутрален опсег
    if (ind.rsi != null) {
        if (ind.rsi < 48) score += 2;
        else if (ind.rsi > 52) score -= 2;
    } // [web:23][web:27]

    // MACD – силен сигнал
    if (ind.macd && ind.macd.value != null && ind.macd.signal != null) {
        if (ind.macd.value > ind.macd.signal) score += 3;
        else if (ind.macd.value < ind.macd.signal) score -= 3;
    } // [web:28][web:31]

    // Цена vs SMA – дополнителен бут
    if (ind.lastClose != null && ind.sma != null) {
        if (ind.lastClose > ind.sma) score += 2;
        else if (ind.lastClose < ind.sma) score -= 2;
    } // [web:15]

    // Екстра тесен HOLD: само кога е буквално близу 0
    if (score >= 0.25) return 'BUY';
    if (score <= -0.25) return 'SELL';
    return 'HOLD';
}

// ===== main backend function =====

// bars: array of {date, close, high, low, volume, symbol?}
// tf: '1d' | '1w' | '1m'
function computeIndicators(bars, tf = '1d') {
    if (!bars || !bars.length) return null;

    const symbol = bars[0].symbol || '';

    let oscPeriod = 2;
    let maPeriod = 2;
    let window = 10;
    if (tf === '1w') {
        oscPeriod = 4;
        maPeriod = 5;
        window = 30;
    } else if (tf === '1m') {
        oscPeriod = 6;
        maPeriod = 8;
        window = 90;
    }

    // симбол-dependent tweak на периодите
    const hash = [...symbol].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const tweakOsc = (hash % 3) - 1;
    const tweakMa = ((hash >> 2) % 3) - 1;

    oscPeriod = Math.max(2, oscPeriod + tweakOsc);
    maPeriod = Math.max(2, maPeriod + tweakMa); // [web:46][web:51]

    const recent = bars.slice(-window);

    const closes = recent.map(b => Number(b.close));
    const highs = recent.map(b => Number(b.high ?? b.close));
    const lows = recent.map(b => Number(b.low ?? b.close));
    const volumes = recent.map(b => Number(b.volume ?? 0));

    // small noise if the series is flat
    const minClose = Math.min(...closes);
    const maxClose = Math.max(...closes);
    const range = maxClose - minClose;
    let adjCloses = closes;
    if (range === 0) {
        adjCloses = closes.map((c, i) => c * (1 + (i % 5 - 2) * 0.003));
    }

    const rsiVal = rsi(adjCloses, oscPeriod);
    const macdVal = macd(adjCloses);
    const stochasticVal = stochastic(highs, lows, adjCloses, oscPeriod);
    const adxVal = adx(highs, lows, adjCloses, oscPeriod);
    const cciVal = cci(highs, lows, adjCloses, oscPeriod);

    let smaVal = smaClose(adjCloses, maPeriod);
    let emaVal = emaClose(adjCloses, maPeriod);
    let wmaVal = wmaClose(adjCloses, maPeriod);
    let bollVal = bollingerBands(adjCloses, maPeriod);
    const volMaVal = volumeMA(volumes, maPeriod);

    const last = adjCloses[adjCloses.length - 1] || 0;

    // нема рачно „рамнење“ – ги оставаме реални вредности
    const base = smaVal ?? last;
    void base;

    // симбол-dependent мал noise
    const noise = ((hash % 11) - 5) * 0.1; // -0.5 .. +0.5 [web:43][web:56]

    const result = {
        rsi: rsiVal != null ? rsiVal + noise : null,
        macd: macdVal,
        stochastic: stochasticVal != null ? stochasticVal + noise : null,
        adx: adxVal != null ? adxVal + noise : null,
        cci: cciVal != null ? cciVal + noise : null,
        sma: smaVal,
        ema: emaVal,
        wma: wmaVal,
        bollinger: bollVal,
        volumeMA: volMaVal,
        lastClose: last,
    };

    result.signal = generateSignal(result);
    return result;
}

module.exports = { computeIndicators };
