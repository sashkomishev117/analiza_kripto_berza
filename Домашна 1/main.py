import os
import time
import requests
import pandas as pd
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

DATA_DIR = "data"
HIST_DIR = "data_history"
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(HIST_DIR, exist_ok=True)

BASE_URL = "https://api.coingecko.com/api/v3"
MAX_THREADS = 8
REQUEST_LIMIT = 45
lock = Lock()


def filter_1_download():
    print("Filter 1: Fetching top 1000 cryptocurrencies...")

    all_coins = []
    for page in range(1, 5):  # 250 per page × 4 pages = 1000
        url = f"{BASE_URL}/coins/markets"
        params = {
            "vs_currency": "usd",
            "order": "market_cap_desc",
            "per_page": 250,
            "page": page,
        }
        r = requests.get(url, params=params)
        if r.status_code != 200:
            print(f"Page {page} failed: {r.status_code}")
            continue
        all_coins.extend(r.json())
        time.sleep(1.2)  # safe delay between batches

    df = pd.DataFrame(all_coins)[["id", "symbol", "name", "market_cap"]]
    df.to_csv(os.path.join(DATA_DIR, "top_1000_full.csv"), index=False)
    print(f"Saved {len(df)} coins → data/top_1000_full.csv")
    return df

def get_coin_history(coin_id):
    try:
        file_path = os.path.join(HIST_DIR, f"{coin_id}.csv")
        if os.path.exists(file_path):
            return f"Skipping {coin_id} (already exists)"

        end_date = int(time.time())
        start_date = end_date - 60 * 60 * 24 * 365 * 10  # 10 years
        url = f"{BASE_URL}/coins/{coin_id}/market_chart/range"
        params = {"vs_currency": "usd", "from": start_date, "to": end_date}
        r = requests.get(url, params=params)
        if r.status_code != 200:
            return f"{coin_id} failed ({r.status_code})"

        data = r.json()
        prices, volumes = data.get("prices", []), data.get("total_volumes", [])
        if not prices:
            return f"No data for {coin_id}"

        df = pd.DataFrame(prices, columns=["timestamp", "price"])
        df["date"] = pd.to_datetime(df["timestamp"], unit="ms").dt.date
        df["volume"] = [v[1] for v in volumes][:len(df)]
        df = df.groupby("date").agg({"price": "mean", "volume": "sum"}).reset_index()
        with lock:
            df.to_csv(file_path, index=False)
            print(f"Saved {coin_id} ({len(df)} days)")
        return f"{coin_id} done"

    except Exception as e:
        return f"{coin_id} error: {e}"


def filter_2_download_all():
    print("Filter 2: Downloading historical OHLCV data (multi-threaded)...")

    df = pd.read_csv(os.path.join(DATA_DIR, "top_1000_full.csv"))
    coin_ids = df["id"].tolist()
    results = []
    existing = {os.path.splitext(f)[0] for f in os.listdir(HIST_DIR) if f.endswith(".csv")}
    todo = [cid for cid in coin_ids if cid not in existing]

    print(f"Skipping {len(existing)} existing coins, downloading {len(todo)} new ones.")

    if not todo:
        print("All data already present.")
        return

    start_time = time.time()
    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        futures = {executor.submit(get_coin_history, cid): cid for cid in todo}
        for i, future in enumerate(as_completed(futures)):
            result = future.result()
            results.append(result)

            # Rate-limit safety
            if i % REQUEST_LIMIT == 0 and i > 0:
                elapsed = time.time() - start_time
                if elapsed < 60:
                    wait = 60 - elapsed
                    print(f"Waiting {wait:.1f}s to respect API limits...")
                    time.sleep(wait)
                start_time = time.time()

    print("Filter 2 complete. Historical data downloaded.")
    return results

def update_coin(coin_id):
    try:
        file_path = os.path.join(HIST_DIR, f"{coin_id}.csv")
        if not os.path.exists(file_path):
            return f"No file for {coin_id}"

        df = pd.read_csv(file_path)
        last_date = pd.to_datetime(df["date"]).max()
        from_ts = int((last_date + timedelta(days=1)).timestamp())
        to_ts = int(time.time())

        url = f"{BASE_URL}/coins/{coin_id}/market_chart/range"
        params = {"vs_currency": "usd", "from": from_ts, "to": to_ts}
        r = requests.get(url, params=params)
        if r.status_code != 200:
            return f"{coin_id} update failed ({r.status_code})"

        data = r.json()
        prices, volumes = data.get("prices", []), data.get("total_volumes", [])
        if not prices:
            return f"No new data for {coin_id}"

        new_df = pd.DataFrame(prices, columns=["timestamp", "price"])
        new_df["date"] = pd.to_datetime(new_df["timestamp"], unit="ms").dt.date
        new_df["volume"] = [v[1] for v in volumes][:len(new_df)]
        new_df = new_df.groupby("date").agg({"price": "mean", "volume": "sum"}).reset_index()

        combined = pd.concat([df, new_df]).drop_duplicates("date").sort_values("date")
        with lock:
            combined.to_csv(file_path, index=False)
            print(f"Updated {coin_id} ({len(new_df)} new rows)")
        return f"{coin_id} updated"

    except Exception as e:
        return f"{coin_id} update error: {e}"


def filter_3_update_all():
    print("Filter 3: Updating existing data...")

    df = pd.read_csv(os.path.join(DATA_DIR, "top_1000_full.csv"))
    coin_ids = df["id"].tolist()
    results = []

    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        futures = {executor.submit(update_coin, cid): cid for cid in coin_ids}
        for i, future in enumerate(as_completed(futures)):
            result = future.result()
            results.append(result)

            if i % REQUEST_LIMIT == 0 and i > 0:
                print("Waiting 60s to respect rate limits...")
                time.sleep(60)

    print("Filter 3 complete. All data up to date.")
    return results


def update_top_1000_with_stats():
    """Add OHLCV-like stats to the top_1000_full.csv file."""
    print("Adding latest market stats to top_1000_full.csv...")

    file_path = os.path.join(DATA_DIR, "top_1000_full.csv")
    if not os.path.exists(file_path):
        print("No top_1000_full.csv found. Run Filter 1 first.")
        return

    df = pd.read_csv(file_path)
    all_updates = []

    for page in range(1, 5):
        url = f"{BASE_URL}/coins/markets"
        params = {
            "vs_currency": "usd",
            "order": "market_cap_desc",
            "per_page": 250,
            "page": page,
            "price_change_percentage": "24h"
        }
        r = requests.get(url, params=params)
        if r.status_code != 200:
            print(f"Page {page} failed ({r.status_code})")
            continue
        all_updates.extend(r.json())
        time.sleep(1.2)

    stats_df = pd.DataFrame(all_updates)[[
        "id", "symbol", "current_price", "high_24h",
        "low_24h", "total_volume", "market_cap", "price_change_percentage_24h"
    ]]

    merged = pd.merge(df, stats_df, on=["id", "symbol"], how="left")
    merged.to_csv(file_path, index=False)
    print("top_1000_full.csv updated with market stats.")


if __name__ == "__main__":
    start = time.time()
    print("Starting CoinGecko Multi-threaded Data Pipeline (FAST MODE)...\n")

    if not os.path.exists(os.path.join(DATA_DIR, "top_1000_full.csv")):
        filter_1_download()

    filter_2_download_all()
    filter_3_update_all()
    update_top_1000_with_stats()

    print(f"\nPipeline finished in {time.time() - start:.2f}s.")
