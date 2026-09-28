import { Router } from "express";
import { getSummary } from "../data";
import { asyncHandler } from "./util";

export const learnRouter = Router();

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

learnRouter.get(
  "/learn",
  asyncHandler(async (_req, res) => {
    const s = getSummary();
    const h1 = s.hermee.find((h) => h.scenario === "H1") ?? s.hermee[0];
    const k = s.keeper;
    const bp3 = s.breach_prob["3"] ?? 0.0247;
    const bp5 = s.breach_prob["5"] ?? 0.0085;
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      title: "How a weekend floor works",
      steps: [
        {
          n: 1,
          title: "Set my floor before the Friday bell",
          body: "Pick the tokenized stock you hold, how much of it to protect, and a floor: 3% means \"if Monday opens more than 3% below Friday's close, make me whole to that line\". The engine quotes a premium in basis points from twenty years of Monday gaps and this week's volatility. The sale window closes hard at the Friday bell.",
        },
        {
          n: 2,
          title: "The Keeper pool backs it in full",
          body: "Your premium goes straight into the Keeper pool (an ERC-4626 vault of USDT). The pool locks the maximum payout, 20% of your notional, before the policy exists, so every floor is fully collateralised. Nothing is levered, nothing is shorted.",
        },
        {
          n: 3,
          title: "Monday morning receipt",
          body: "At the first official Monday opening print the oracle settles every policy. If the stock opened above your floor: \"Floor held\", the premium was the cost of a quiet weekend. If it gapped below: \"Floor paid $X\", the difference between your floor and the open lands in your wallet as USDT.",
        },
      ],
      example: {
        hermee: h1
          ? {
              name: "Hermee",
              role: "holder",
              ticker: h1.ticker,
              period: `${h1.start} to ${h1.end}`,
              invested: h1.invested,
              premiumsPaid: h1.paid,
              payoutsReceived: h1.received,
              worstWeekendBare: h1.worst_bare,
              worstWeekendCovered: h1.worst_covered,
              peaceOfMindIndex: h1.pmi,
              sentence: `Hermee holds ${usd(h1.invested)} of ${h1.ticker}. From ${h1.start.slice(0, 4)} to ${h1.end.slice(0, 4)} she paid ${usd(h1.paid)} in weekend premiums and was paid ${usd(h1.received)} back; her worst Monday morning was -${usd(h1.worst_covered)} instead of -${usd(h1.worst_bare)}.`,
            }
          : null,
        kip: {
          name: "Kip",
          role: "keeper",
          returnOnCapitalPa: k.roc_pa,
          returnOnCapitalSince2015: k.roc_pa_since_2015,
          sharpe: k.sharpe,
          shareOfWeekendsLosing: k.share_weekends_losing,
          worstWeekend: k.worst_weekend,
          worstWeekendPctCapital: k.worst_weekend_pct_capital,
          ruinProbabilityOneYear: k.ruin_1y_10pct_capital,
          sentence: `Kip puts USDT behind the floors. Over 2005-2026 a pool at 10% capital earned about ${(k.roc_pa * 100).toFixed(0)}% a year (${(k.roc_pa_since_2015 * 100).toFixed(0)}% since 2015, Sharpe ${k.sharpe}), lost money on ${(k.share_weekends_losing * 100).toFixed(0)}% of weekends, and its worst weekend (${k.worst_weekend}) cost ${(Math.abs(k.worst_weekend_pct_capital) * 100).toFixed(0)}% of capital. CPPI sizing in this vault keeps half the pool as a floor that no single weekend can touch.`,
        },
        allScenarios: s.hermee,
      },
      numbers: {
        universe: s.universe,
        breachProbability: s.breach_prob,
        fairPremiumBp5pct: s.fair_premium_bp_5pct,
        lossRatio: s.loss_ratio_v4,
      },
      faq: [
        {
          q: "What exactly am I buying?",
          a: "A weekend floor: fully collateralised cover attached to a spot position in a tokenized stock. If the Monday open is below Friday's close by more than your floor, you receive the shortfall (capped at 20% of notional) in USDT. It is not leverage and it is not a short.",
        },
        {
          q: "How is the price set?",
          a: `Empirically, not with Black-Scholes. Every weekend gap since 2005 across ${s.universe.tickers} names is standardised by that week's volatility and pooled. Your fair price is the average payout of your floor over that pool at today's volatility; we add a 50% margin and never charge less than 1 basis point. Roughly ${(bp3 * 100).toFixed(1)}% of weekends breach a 3% floor and ${(bp5 * 100).toFixed(2)}% breach 5%.`,
        },
        {
          q: "What is the estimated-value line?",
          a: "Every quote shows the fair price, our margin and what the engine expects to pay back over many weekends. Over the backtest the pool paid back about 57 cents of every premium dollar. Protection is worth more than that to most holders because it removes the worst mornings, but you should know the number.",
        },
        {
          q: "When can I buy and when does it settle?",
          a: "You can set a floor any time before the Friday bell (the epoch's bind deadline). Nobody can buy after the close, because pre-market and Sunday futures reveal most of the gap before tokens move. Settlement uses the first official Monday opening print; if the underlying is halted or has a corporate action that weekend, the epoch is voided and premiums are returned.",
        },
        {
          q: "What does the Keeper pool earn and risk?",
          a: "Keepers deposit USDT and receive kUSDT shares. Premiums flow in every Friday, payouts flow out on bad Mondays. The pool only sells cover against its cushion above a 50% floor (CPPI), so a single weekend cannot breach the floor. Historically a pool sized at 10% of covered notional earned 7-10% a year with losses on about 6% of weekends.",
        },
        {
          q: "What can the admin do, and is this real money?",
          a: "This is a hackathon build on testnets. The deployer can pause both contracts, change parameters, void or force-settle policies and rescue tokens. Testnet USDT and stocks come from faucets. It is not available in restricted jurisdictions and nothing here is investment advice.",
        },
      ],
      vocabulary: {
        product: "Weekend floor",
        buy: "Set my floor",
        vault: "Keeper pool",
        lpTab: "Keep",
        buyerTab: "Protect",
        positions: "My weekends",
        receiptHeld: "Floor held",
        receiptPaid: "Floor paid $X",
        streak: "weekends protected",
        meter: "peace-of-mind meter",
      },
    });
  }),
);
