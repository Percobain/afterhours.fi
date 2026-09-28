/**
 * Plain-English copy used across the app. One source so every screen explains things the same way.
 * Rule: no "bp", "notional", "epoch", "barrier" in visible UI text. Dollars, percent and sentences only.
 */

export const GLOSSARY = {
  protection: {
    term: "Weekend protection",
    short: "A one-weekend safety net for a stock you hold.",
    long: "You pay a small fee on Friday. If the stock opens on Monday lower than your protection line, you get the difference back in USDT. If it doesn’t, nothing happens and you keep your stock.",
  },
  line: {
    term: "Protection line",
    short: "How far the stock can fall before we start paying you.",
    long: "A 3% line means: if Monday’s opening price is more than 3% below Friday’s closing price, you are paid everything below that 3%. Tighter lines cost more; looser lines cost less.",
  },
  cost: {
    term: "Weekly cost",
    short: "What you pay once, on Friday, for one weekend.",
    long: "Priced from 21 years of real weekend moves across 50 stocks and how jumpy the stock is this week. You see the exact dollar amount before you confirm.",
  },
  maxPayout: {
    term: "Maximum payout",
    short: "The most one weekend can pay: 20% of the amount you protect.",
    long: "The pool locks this amount the moment you buy, so the money to pay you is already set aside.",
  },
  bell: {
    term: "The Friday bell",
    short: "4:00 pm New York on Friday, when the US stock market closes.",
    long: "Protection for a weekend can only be bought before the bell. After it, prices can’t move on the stock exchange until Monday 9:30 am New York.",
  },
  mondayOpen: {
    term: "Monday open",
    short: "9:30 am New York on Monday, when the market reopens.",
    long: "We compare the official Monday opening price with Friday’s closing price. That single number decides whether your protection pays.",
  },
  pool: {
    term: "Protection pool",
    short: "The shared USDT pot that pays out protection.",
    long: "People who want to earn deposit USDT here. The pool collects every weekly fee and pays out on bad Mondays. It can only sell as much protection as it can fully pay.",
  },
  safetyFloor: {
    term: "Safety reserve",
    short: "Half of the pool that is never used to back new protection.",
    long: "Only the other half can be put at risk. After a bad weekend the pool automatically sells less protection until it recovers.",
  },
  testnet: {
    term: "Test network",
    short: "A practice version of the blockchain. The money is not real.",
    long: "Everything here runs on Ethereum Sepolia or BNB Chain testnet. Tokens come free from the faucet buttons. Gas comes from a public faucet.",
  },
  gas: {
    term: "Gas",
    short: "The small network fee your wallet pays for each transaction.",
    long: "On a test network gas is free from a faucet website. You need a little of it before you can do anything.",
  },
  approve: {
    term: "Allow USDT",
    short: "A one-time permission so the app can take the exact fee.",
    long: "Wallets ask you to allow a token before a contract can move it. We ask only for the exact amount you are paying.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

/** Weekend-risk label from annualised 20-day volatility. */
export function riskLevel(rv20?: number): { label: "Calm" | "Normal" | "Lively" | "Wild"; tone: "held" | "keeper" | "floor" | "gap"; blurb: string } {
  const v = rv20 ?? 0.35;
  if (v < 0.2) return { label: "Calm", tone: "held", blurb: "Big weekend moves are rare." };
  if (v < 0.35) return { label: "Normal", tone: "keeper", blurb: "Occasional big weekend moves." };
  if (v < 0.55) return { label: "Lively", tone: "floor", blurb: "Big weekend moves happen a few times a year." };
  return { label: "Wild", tone: "gap", blurb: "Big weekend moves are common. Protection costs more." };
}

/** "about 1 in N weekends" from a probability. */
export function oneIn(p?: number): string {
  if (!p || p <= 0) return "very rarely";
  const n = Math.round(1 / p);
  if (n <= 1) return "most weekends";
  if (n >= 400) return "almost never";
  return `about 1 in ${n} weekends`;
}

export const LEVELS: { bps: number; name: string; tagline: string; recommended?: boolean }[] = [
  { bps: 200, name: "Tight", tagline: "Pays after a 2% drop" },
  { bps: 300, name: "Recommended", tagline: "Pays after a 3% drop", recommended: true },
  { bps: 500, name: "Standard", tagline: "Pays after a 5% drop" },
  { bps: 1000, name: "Crash only", tagline: "Pays after a 10% drop" },
];

export const EXTRA_LEVELS = [100, 700];

export const PAGE_HELP: Record<string, { title: string; steps: { h: string; p: string }[] }> = {
  protect: {
    title: "How protecting a weekend works",
    steps: [
      { h: "1. Pick a stock you hold", p: "Choose the tokenized stock you want to protect. You need to actually hold it in your wallet (on testnet, the faucet gives you some for free)." },
      { h: "2. Say how much", p: "Type how many dollars of it you want to protect. It can be part of what you hold." },
      { h: "3. Choose your protection line", p: "This is how far the stock can fall before we pay you. 3% is our recommendation for most stocks. You see the exact cost for each option." },
      { h: "4. Confirm before the Friday bell", p: "Your wallet will ask you to confirm once or twice. After that there is nothing to do. On Monday at 9:30 am New York it settles by itself and you get a receipt." },
    ],
  },
  earn: {
    title: "How earning works",
    steps: [
      { h: "You add USDT to the pool", p: "Your deposit joins everyone else’s in the protection pool. You get a pool share token that tracks your part." },
      { h: "The pool sells weekend protection", p: "Every Friday people pay small fees to protect their stocks. All of those fees go into the pool, so your share grows." },
      { h: "Sometimes the pool pays out", p: "When a stock opens much lower on Monday, the pool pays those holders. Most weekends nothing is paid; a few times a year something is." },
      { h: "Built-in safety", p: "Half the pool is a safety reserve that is never put at risk, and every protection is fully paid for before it is sold. You can withdraw anything that isn’t set aside for this weekend." },
    ],
  },
  activity: {
    title: "What you see here",
    steps: [
      { h: "Active this weekend", p: "Protection you bought for the coming or current weekend. Nothing to do: it settles by itself on Monday." },
      { h: "Receipts", p: "After Monday’s open each weekend gets a receipt: either “Stock held up, nothing needed” or “We paid you $X”." },
      { h: "Collect", p: "If a payout is ready but hasn’t been sent yet, a Collect button appears. Anyone can press it; the money always goes to you." },
      { h: "Your streak", p: "Counts weekends you protected in a row. It rewards being careful, never trading." },
    ],
  },
};
