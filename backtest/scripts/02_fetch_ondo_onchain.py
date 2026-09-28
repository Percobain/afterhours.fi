"""Pull Ondo (xxxon) on-chain klines on BSC from the public Binance Web3 RWA endpoint (no key needed).
Politely paced (0.6s between calls). 1h x 300 (~12 days) and 4h x 300 (~50 days) per token.
Cached to data/ondo/<SYMBOL>_<interval>.json"""
import os, json, time, requests
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "ondo"); os.makedirs(OUT, exist_ok=True)
H = {"Accept-Encoding": "identity", "User-Agent": "binance-web3/1.1 (Skill)"}
KL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/dex/market/token/kline/ai"
DYN = "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai"
lst = json.load(open(os.path.join(ROOT, "data", "binance_rwa_token_list_raw.json")))["data"]
want = ["NVDAon","AAPLon","TSLAon","SPYon","QQQon","MSTRon","COINon","CRCLon","MSFTon","GOOGLon","METAon","AMZNon","HOODon"]
toks = {x["symbol"]: x for x in lst if x["chainId"] == "56" and x["symbol"] in want}
log = []
for sym, x in toks.items():
    for iv in ("1h", "4h", "1d"):
        fp = os.path.join(OUT, f"{sym}_{iv}.json")
        r = requests.get(KL, params={"chainId": "56", "contractAddress": x["contractAddress"], "interval": iv, "limit": 300}, headers=H, timeout=30)
        j = r.json(); data = j.get("data") or []
        json.dump({"token": x, "interval": iv, "data": data}, open(fp, "w"))
        log.append((sym, iv, r.status_code, len(data)))
        print(sym, iv, r.status_code, "candles:", len(data)); time.sleep(0.6)
    r = requests.get(DYN, params={"chainId": "56", "contractAddress": x["contractAddress"]}, headers=H, timeout=30)
    json.dump(r.json(), open(os.path.join(OUT, f"{sym}_dynamic.json"), "w"), indent=1); time.sleep(0.6)
json.dump(log, open(os.path.join(OUT, "_fetch_log.json"), "w"))
