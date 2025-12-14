import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"   # 0=all, 1=INFO, 2=WARNING, 3=ERROR

import warnings
warnings.filterwarnings("ignore")

import tensorflow as tf
tf.get_logger().setLevel("ERROR")

import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_percentage_error, r2_score
from math import sqrt
import matplotlib.pyplot as plt

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Input

# 1) Load data
df = pd.read_csv("btc_history.csv")
df["date"] = pd.to_datetime(df["date"])
df = df.sort_values("date")

# 1.1) Clean column names: lowercase, strip spaces
df.columns = df.columns.str.strip().str.lower()

print("Columns:", df.columns)

# We expect: high, low, close, volume  (no 'open' in your file)
feature_cols = ["high", "low", "close", "volume"]

# Check columns exist
for c in feature_cols:
    if c not in df.columns:
        raise ValueError(f"Column '{c}' not found in DataFrame! Real columns: {df.columns}")

values = df[feature_cols].values

# 2) Scale all features
scaler = MinMaxScaler(feature_range=(0, 1))
scaled = scaler.fit_transform(values)

# Target index (close) and number of features
target_col_index = feature_cols.index("close")
n_features = len(feature_cols)

def create_sequences_multivariate(data, lookback, target_col_index):
    X, y = [], []
    for i in range(lookback, len(data)):
        X.append(data[i - lookback:i, :])          # all features
        y.append(data[i, target_col_index])        # target: close
    return np.array(X), np.array(y)

def build_model(lookback, n_features):
    model = Sequential()
    model.add(Input(shape=(lookback, n_features)))
    model.add(LSTM(64))
    model.add(Dense(1))
    model.compile(optimizer="adam", loss="mse")
    return model

# Will use these to inverse-transform the close price
close_min = scaler.data_min_[target_col_index]
close_max = scaler.data_max_[target_col_index]

def inverse_close(x):
    # x is in [0,1] scale for close
    return x * (close_max - close_min) + close_min

# 3) Evaluate different lookback values
lookback_values = [15, 30, 60]
results = {}
best_model = None
best_lb = None
best_rmse = float("inf")
best_last_window = None

for lb in lookback_values:
    print(f"\nTraining model with lookback={lb} days")
    X, y = create_sequences_multivariate(scaled, lb, target_col_index)

    split_index = int(len(X) * 0.7)
    X_train, X_val = X[:split_index], X[split_index:]
    y_train, y_val = y[:split_index], y[split_index:]

    model = build_model(lb, n_features)

    model.fit(
        X_train, y_train,
        epochs=20,
        batch_size=32,
        validation_data=(X_val, y_val),
        verbose=1    # show epochs
    )

    y_val_pred = model.predict(X_val).ravel()

    # Inverse scaling for close
    y_val_inv = inverse_close(y_val)
    y_val_pred_inv = inverse_close(y_val_pred)

    mse = mean_squared_error(y_val_inv, y_val_pred_inv)
    rmse = sqrt(mse)
    mape = mean_absolute_percentage_error(y_val_inv, y_val_pred_inv)
    r2 = r2_score(y_val_inv, y_val_pred_inv)

    results[lb] = (rmse, mape, r2)
    print(f"lookback={lb}: RMSE={rmse:.4f}, MAPE={mape:.4f}, R2={r2:.4f}")

    # Save best model by RMSE
    if rmse < best_rmse:
        best_rmse = rmse
        best_lb = lb
        best_model = model
        best_last_window = scaled[-lb:, :]

# 4) Print results table
print("\nResults by lookback:")
print("Lookback\tRMSE\t\tMAPE\t\tR2")
for lb in lookback_values:
    rmse, mape, r2 = results[lb]
    print(f"{lb}\t\t{rmse:.4f}\t{mape:.4f}\t{r2:.4f}")

# 5) Plot for the best lookback
X_best, y_best = create_sequences_multivariate(scaled, best_lb, target_col_index)
split_index = int(len(X_best) * 0.7)
X_train_b, X_val_b = X_best[:split_index], X_best[split_index:]
y_train_b, y_val_b = y_best[:split_index], y_best[split_index:]

y_val_pred_b = best_model.predict(X_val_b).ravel()
y_val_inv_b = inverse_close(y_val_b)
y_val_pred_inv_b = inverse_close(y_val_pred_b)

dates_val = df["date"].values[-len(y_val_inv_b):]

plt.figure(figsize=(10, 5))
plt.plot(dates_val, y_val_inv_b, label="Real price")
plt.plot(dates_val, y_val_pred_inv_b, label="Predicted price")
plt.xlabel("Date")
plt.ylabel("Price (USD)")
plt.title(f"Bitcoin price - real vs LSTM prediction (lookback={best_lb})")
plt.legend()
plt.tight_layout()
plt.show()

# 6) Forecast the next 7 days using the best model
future_days = 7
last_window = best_last_window.reshape(1, best_lb, n_features)
future_scaled = []

for _ in range(future_days):
    next_scaled = best_model.predict(last_window)
    # next_scaled is only for close; keep other features equal to last step
    next_step = last_window[:, -1, :].copy()
    next_step[0, target_col_index] = next_scaled[0, 0]
    future_scaled.append(next_scaled[0, 0])
    last_window = np.append(last_window[:, 1:, :], next_step.reshape(1, 1, n_features), axis=1)

future_scaled = np.array(future_scaled)
future = inverse_close(future_scaled)

print(f"\nBest lookback: {best_lb} days (RMSE={best_rmse:.4f})")
print("Next 7 days forecast (close price):")
for i, p in enumerate(future, 1):
    print(f"Day +{i}: {p:.2f}")
