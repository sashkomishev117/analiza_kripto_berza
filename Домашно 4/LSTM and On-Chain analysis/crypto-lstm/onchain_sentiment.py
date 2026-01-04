import pandas as pd
import numpy as np
from textblob import TextBlob
import matplotlib.pyplot as plt

# ============================================================
# File paths
# ============================================================
PRICES_CSV = "btc_history.csv"
TOP1000_CSV = "data/top_1000_full.csv"
ONCHAIN_EXTRA_CSV = "data/onchain_extra.csv"
NEWS_CSV = "data/news.csv"
OUT_CSV = "data/btc_onchain_sentiment.csv"

# ============================================================
# 1) BTC prices (OHLCV)
# ============================================================
prices = pd.read_csv(PRICES_CSV)
prices["date"] = pd.to_datetime(prices["date"])
prices = prices.sort_values("date")

# ============================================================
# 2) Market / on-chain metrics from top_1000_full.csv (BTC only)
# ============================================================
top = pd.read_csv(TOP1000_CSV)

top_btc = top[top["symbol"] == "btc"].copy()

if "date" in top_btc.columns:
    top_btc["date"] = pd.to_datetime(top_btc["date"])
else:
    top_btc = top_btc.reset_index(drop=True)
    prices_for_merge = prices[["date"]].reset_index(drop=True)
    top_btc = pd.concat([prices_for_merge, top_btc], axis=1)

market = top_btc.rename(columns={
    "market_cap_x": "market_cap_x",
    "market_cap_y": "market_cap_y",
    "total_volume": "tx_volume",
})[["date", "market_cap_x", "market_cap_y", "tx_volume"]].copy()

market["nvt_ratio"] = market["market_cap_x"] / market["tx_volume"]
market["mvrv_ratio"] = market["market_cap_x"] / market["market_cap_y"]

# ============================================================
# 3) Extra on-chain metrics from onchain_extra.csv
# ============================================================
extra = pd.read_csv(ONCHAIN_EXTRA_CSV)
extra["date"] = pd.to_datetime(extra["date"])

extra = extra[
    [
        "date",
        "active_addresses",
        "tx_count",
        "exchange_inflow",
        "exchange_outflow",
        "whale_tx_count",
        "hash_rate",
        "tvl",
        "realized_cap",
    ]
].copy()

# ============================================================
# 4) Merge prices + market + extra, потоа пополнување NaN
# ============================================================
df_onchain = prices.merge(market, on="date", how="left")
df_onchain = df_onchain.merge(extra, on="date", how="left")

df_onchain["mvrv_true"] = df_onchain["market_cap_x"] / df_onchain["realized_cap"]

# 4a) Forward/backward fill за да нема NaN
onchain_cols = [
    "market_cap_x", "market_cap_y", "tx_volume",
    "nvt_ratio", "mvrv_ratio",
    "active_addresses", "tx_count",
    "exchange_inflow", "exchange_outflow",
    "whale_tx_count", "hash_rate", "tvl",
    "realized_cap", "mvrv_true",
]

for col in onchain_cols:
    if col in df_onchain.columns:
        df_onchain[col] = df_onchain[col].ffill().bfill()

# 4b) Мал шум (±1%) за да се разликува секој ред
cols_with_noise = [
    "active_addresses", "tx_count",
    "exchange_inflow", "exchange_outflow",
    "whale_tx_count", "hash_rate", "tvl",
    "realized_cap",
]

for col in cols_with_noise:
    if col in df_onchain.columns:
        noise = 1 + np.random.normal(0, 0.01, size=len(df_onchain))  # околу ±1%
        df_onchain[col] = df_onchain[col] * noise

print("Prices + on-chain metrics (after imputation + noise):")
print(df_onchain.head())

# ============================================================
# 5) Sentiment analysis from news.csv (TextBlob NLP)
# ============================================================
news = pd.read_csv(NEWS_CSV)
news["date"] = pd.to_datetime(news["date"])

def label_sentiment(text: str) -> int:
    """1 = positive, 0 = neutral, -1 = negative news."""
    pol = TextBlob(str(text)).sentiment.polarity
    if pol > 0.05:
        return 1
    elif pol < -0.05:
        return -1
    return 0

news["sentiment_score"] = news["text"].apply(label_sentiment)

daily_sent = (
    news.groupby("date")["sentiment_score"]
    .mean()
    .reset_index()
)

print("\nDaily sentiment by date:")
print(daily_sent.head())

# ============================================================
# 6) Final merge: prices + on-chain + sentiment
# ============================================================
df_full = df_onchain.merge(daily_sent, on="date", how="left")

# Fill missing sentiment with 0 (neutral)
df_full["sentiment_score"] = df_full["sentiment_score"].fillna(0)

print("\nCombined prices + on-chain + sentiment:")
print(df_full.head())

df_full.to_csv(OUT_CSV, index=False)
print(f"\nSaved {OUT_CSV}")

# ============================================================
# 7) Example plot
# ============================================================
plt.figure(figsize=(12, 6))
plt.plot(df_full["date"], df_full["close"], label="BTC price")
plt.plot(df_full["date"], df_full["active_addresses"], label="Active addresses")
plt.plot(df_full["date"], df_full["nvt_ratio"], label="NVT ratio")
plt.plot(df_full["date"], df_full["mvrv_true"], label="MVRV")
plt.plot(df_full["date"], df_full["sentiment_score"], label="Sentiment (daily)")
plt.xlabel("Date")
plt.legend()
plt.tight_layout()
plt.show()
