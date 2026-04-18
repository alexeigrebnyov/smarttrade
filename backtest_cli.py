#!/usr/bin/env python3
import argparse
import pandas as pd
import numpy as np
import json
from math import sqrt
import matplotlib.pyplot as plt
from pathlib import Path

def discover_pairs(df):
    cols = df.columns.tolist()
    pairs = []
    for c in cols:
        if c.endswith("_Raydium"):
            base = c[:-8]
            ocol = base + "_Orca"
            if ocol in cols:
                pairs.append((base, c, ocol))
    return pairs

def backtest_pair(df, name, ray_col, orca_col, threshold, volume):
    mid = (df[ray_col] + df[orca_col]) / 2.0
    diff_rel = (df[ray_col] - df[orca_col]) / mid
    edge = diff_rel.abs()
    take = edge > threshold
    step_pnl = np.where(take, (edge - threshold) * volume, 0.0)
    pnl_series = pd.Series(step_pnl).cumsum()
    drawdown_series = pnl_series - pnl_series.cummax()
    max_drawdown_abs = float(abs(drawdown_series.min()))
    sharpe = float((pd.Series(step_pnl).mean() / pd.Series(step_pnl).std() * np.sqrt(len(step_pnl)))
                   if pd.Series(step_pnl).std() > 0 else 0.0)
    trades_count = int(take.sum())
    avg_edge_bps = float((edge[take].mean() * 10000.0) if trades_count > 0 else 0.0)

    per_step = pd.DataFrame({
        "timestamp": df["timestamp"],
        f"{name}_edge_bps": edge * 10000.0,
        f"{name}_take": take.astype(int),
        f"{name}_step_pnl": step_pnl,
        f"{name}_cum_pnl": pnl_series,
    })
    summary = {
        "pair": name.replace("_", "/"),
        "final_pnl": float(pnl_series.iloc[-1]),
        "max_drawdown": max_drawdown_abs,
        "sharpe_like": sharpe,
        "trades": trades_count,
        "avg_edge_bps_on_trades": avg_edge_bps,
    }
    return per_step, summary

def main():
    ap = argparse.ArgumentParser(description="Simple arbitrage backtester for Raydium/Orca pairs")
    ap.add_argument("--csv", required=True, help="Input CSV with timestamp and *_Raydium/*_Orca columns")
    ap.add_argument("--volume", type=float, default=100.0, help="Notional per step")
    ap.add_argument("--fee-ray-bps", type=float, default=30, help="Raydium fee in bps")
    ap.add_argument("--fee-orca-bps", type=float, default=30, help="Orca fee in bps")
    ap.add_argument("--slippage-bps", type=float, default=10, help="Slippage in bps")
    ap.add_argument("--out-prefix", default="backtest", help="Output file prefix")
    args = ap.parse_args()

    threshold_bps = args.fee_ray_bps + args.fee_orca_bps + args.slippage_bps
    threshold = threshold_bps / 10000.0

    df = pd.read_csv(args.csv)
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    pairs = discover_pairs(df)
    if not pairs:
        raise SystemExit("No pairs discovered (need *_Raydium and *_Orca columns).")

    per_frames = []
    summaries = []

    for base, rcol, ocol in pairs:
        per, summ = backtest_pair(df, base, rcol, ocol, threshold, args.volume)
        per_frames.append(per)
        summaries.append(summ)

    per_merged = per_frames[0]
    for i in range(1, len(per_frames)):
        per_merged = per_merged.merge(per_frames[i], on="timestamp", how="outer")
    per_merged = per_merged.sort_values("timestamp")

    per_csv = f"{args.out_prefix}_per_step.csv"
    sum_json = f"{args.out_prefix}_summary.json"
    per_merged.to_csv(per_csv, index=False)
    with open(sum_json, "w") as f:
        json.dump(summaries, f, ensure_ascii=False, indent=2)

    # Plot
    plt.figure()
    for base, _, _ in pairs:
        plt.plot(per_merged["timestamp"], per_merged[f"{base}_cum_pnl"], label=f"{base.replace('_','/')} cum PnL")
    plt.xlabel("Time (UTC)")
    plt.ylabel("Cumulative PnL (arb. units)")
    plt.title("Backtest: Cumulative PnL (all routes)")
    plt.legend()
    plot_path = f"{args.out_prefix}_cum_pnl.png"
    plt.savefig(plot_path, bbox_inches="tight")
    plt.close()

    print("Saved:", per_csv, sum_json, plot_path)

if __name__ == "__main__":
    main()
