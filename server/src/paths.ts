import path from "node:path";

/** server/ root: src/ when running under tsx, dist/ after tsc; both sit one level below the package root. */
export const SERVER_ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(SERVER_ROOT, "data");
export const DEPLOYMENTS_DIR = path.join(SERVER_ROOT, "deployments");
export const MONOREPO_ROOT = path.resolve(SERVER_ROOT, "..");
export const RWA_TOKEN_LIST_PATH = path.join(MONOREPO_ROOT, "backtest", "data", "binance_rwa_token_list_raw.json");
