"""Pull bStock spot klines (1h) from Binance public REST since listing.
Rate-limit aware: reads X-MBX-USED-WEIGHT-1M, sleeps if > 40% of 6000, backs off on 429/418.
Cached to data/bstocks/<SYMBOL>_1h.csv (append-only refresh)."""
import os, time, json, requests, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "bstocks"); os.makedirs(OUT, exist_ok=True)
BASE = "https://api.binance.com"
SYMS = ["AAPLB","NVDAB","TSLAB","MSFTB","METAB","GOOGLB","AMZNB","SPYB","QQQB","TQQQB","SQQQB","COINB","HOODB","MSTRB","CRCLB"]
LIMIT_W = 6000; SOFT = 0.4*LIMIT_W
log = {"requests":0, "max_weight":0, "backoffs":0}
def get(path, **params):
    for attempt in range(6):
        r = requests.get(BASE+path, params=params, timeout=30)
        log["requests"] += 1
        w = int(r.headers.get("x-mbx-used-weight-1m", 0)); log["max_weight"] = max(log["max_weight"], w)
        if r.status_code in (429, 418):
            ra = int(r.headers.get("Retry-After", 10)); log["backoffs"] += 1
            print(f"  rate limited ({r.status_code}); sleeping {ra}s"); time.sleep(ra+1); continue
        r.raise_for_status()
        if w > SOFT: time.sleep(5)
        return r.json()
    raise RuntimeError("too many retries")
for s in SYMS:
    sym = s+"USDT"; fp = os.path.join(OUT, f"{sym}_1h.csv")
    start = 0
    if os.path.exists(fp):
        old = pd.read_csv(fp); start = int(old["openTime"].iloc[-1]) + 1
    rows = []
    while True:
        k = get("/api/v3/klines", symbol=sym, interval="1h", startTime=start, limit=1000)
        if not k: break
        rows += k; start = k[-1][0] + 1
        if len(k) < 1000: break
        time.sleep(0.25)
    cols = ["openTime","open","high","low","close","volume","closeTime","quoteVolume","trades","takerBuyBase","takerBuyQuote","ignore"]
    df = pd.DataFrame(rows, columns=cols)
    if os.path.exists(fp) and len(df): df = pd.concat([old, df], ignore_index=True)
    elif os.path.exists(fp): df = old
    df.to_csv(fp, index=False)
    print(f"{sym}: {len(df)} hourly candles, from {pd.to_datetime(df['openTime'].iloc[0], unit='ms')} (weight now {log['max_weight']})")
json.dump(log, open(os.path.join(OUT, "_fetch_log.json"), "w"), indent=1)
print("fetch log:", log)
