import requests
import pandas as pd

# 1) Повлекување историски цени од CoinGecko (последни 365 дена)
url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart"
params = {
    "vs_currency": "usd",
    "days": "365",   # последна година
    "interval": "daily"
}

resp = requests.get(url, params=params)
data = resp.json()

prices = data["prices"]          # [timestamp, price]
market_caps = data["market_caps"]
volumes = data["total_volumes"]

rows = []
for (t, price), (_, mcap), (_, vol) in zip(prices, market_caps, volumes):
    rows.append({
        "date": pd.to_datetime(t, unit="ms"),
        "close": price,
        "high": price,   # ако немаме OHLC, ставаме исто како пример
        "low": price,
        "volume": vol
    })

df = pd.DataFrame(rows)
df = df.sort_values("date")
df.to_csv("btc_history.csv", index=False)
print("Saved", len(df), "rows to btc_history.csv")
