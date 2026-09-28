"use client";
import type { ReactNode } from "react";
import clsx from "clsx";
import { MondaySimulator } from "@/components/MondaySimulator";
import { StockMark } from "@/components/ui/StockMark";

/* Part I of /docs: the product as a story, with round numbers anyone can check in their head. */

export const STORY_SECTIONS = [
  { id: "story-problem", n: "I.1", t: "Friday, 4 pm: the problem" },
  { id: "story-hermee", n: "I.2", t: "How Hermee saves her weekend" },
  { id: "story-kip", n: "I.3", t: "How Kip makes money" },
  { id: "story-under", n: "I.4", t: "What happens underneath" },
  { id: "story-honest", n: "I.5", t: "The honest part" },
];

function Chapter({ id, n, title, children }: { id: string; n: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-floor">{n}</div>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]">{title}</h3>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl text-[17px] leading-[1.75] text-ink-2">{children}</p>;
}
function B({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-ink">{children}</b>;
}

/** A worked sum, shown like a receipt: one line per step, result underlined. */
function Sum({ title, lines, result, tone = "floor" }: { title: string; lines: [string, string][]; result: [string, string]; tone?: "floor" | "keeper" | "gap" | "held" }) {
  const c = { floor: "text-floor", keeper: "text-keeper", gap: "text-gap", held: "text-held" }[tone];
  return (
    <div className="my-5 max-w-xl rounded-2xl border border-line bg-surface-2 p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">{title}</div>
      <dl className="mt-3 space-y-1.5 font-mono text-[13.5px]">
        {lines.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-6">
            <dt className="text-ink-2">{k}</dt>
            <dd className="tnum text-ink">{v}</dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between gap-6 border-t border-line pt-2">
          <dt className="font-semibold text-ink">{result[0]}</dt>
          <dd className={clsx("tnum font-semibold", c)}>{result[1]}</dd>
        </div>
      </dl>
    </div>
  );
}

function Scene({ who, time, children }: { who: "hermee" | "kip"; time: string; children: ReactNode }) {
  return (
    <div className={clsx("max-w-3xl rounded-2xl border-l-2 py-1 pl-5", who === "hermee" ? "border-floor" : "border-keeper")}>
      <div className={clsx("text-xs font-semibold uppercase tracking-wider", who === "hermee" ? "text-floor" : "text-keeper")}>{time}</div>
      <div className="mt-1.5 text-[17px] leading-[1.75] text-ink-2">{children}</div>
    </div>
  );
}

export function Story() {
  return (
    <div className="space-y-16">
      {/* ------------------------------------------------ I.1 */}
      <Chapter id="story-problem" n="I.1" title="Friday, 4 pm: the problem">
        <P>
          Every Friday at 4:00 pm New York the US stock market closes. It doesn’t reopen until Monday at 9:30 am. That’s <B>65 and a half hours</B> every week when nobody can buy or sell a US stock on the exchange.
        </P>
        <P>
          News doesn’t stop for the weekend. When something big happens on a Saturday, a war, a rate cut, a Chinese AI model that spooks the market, it all lands at once when the market reopens. The stock doesn’t slide down during the day where you could react; it simply <B>opens</B> lower. That jump is called a <B>gap</B>, and a stop-loss can’t protect you from it, because the first price it can sell at is already the low one.
        </P>
        <P>
          Tokenized stocks, like <B>Binance bStocks</B> and <B>Ondo Stocks</B>, are digital versions of the same shares that live on a blockchain. They can move all weekend, but their value still depends on where the real stock opens on Monday. So the weekend risk is still there. Until now, there was simply no way to hand it to someone else.
        </P>
      </Chapter>

      {/* ------------------------------------------------ I.2 */}
      <Chapter id="story-hermee" n="I.2" title="How Hermee saves her weekend">
        <div className="flex max-w-3xl items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4">
          <StockMark ticker="NVDA" size={40} />
          <p className="text-sm leading-relaxed text-ink-2">
            <B>Meet Hermee.</B> She holds <B>50 shares of Nvidia</B> as bStocks. At <B>$200 a share</B>, that’s <B>$10,000</B>. She isn’t selling, but she hates the feeling of waking up on Monday to a bad surprise.
          </p>
        </div>

        <Scene who="hermee" time="Friday, 2:30 pm">
          She opens afterhours.fi and picks <B>Nvidia</B>, <B>$10,000</B>, and a <B>3% protection line</B>. That means: if Nvidia opens more than 3% lower on Monday, she gets back everything below that 3%. The app shows her the price for this one weekend: <B>$2</B>. She pays it. Her shares stay in her wallet.
        </Scene>
        <Scene who="hermee" time="Saturday">
          Bad news breaks about AI chips. Nvidia’s token wobbles all weekend. Hermee doesn’t check. There’s nothing to do.
        </Scene>
        <Scene who="hermee" time="Monday, 9:30 am">
          Nvidia opens <B>12% lower</B>, at $176 a share. Here is what happens to her money:
        </Scene>

        <div className="grid max-w-3xl gap-4 md:grid-cols-2">
          <Sum
            title="Without protection"
            tone="gap"
            lines={[
              ["Friday value (50 × $200)", "$10,000"],
              ["Monday value (50 × $176)", "$8,800"],
            ]}
            result={["Hermee loses", "−$1,200"]}
          />
          <Sum
            title="With protection (3% line)"
            tone="floor"
            lines={[
              ["Stock falls 12%", "−$1,200"],
              ["First 3% is hers (3% × $10,000)", "−$300 of it"],
              ["We pay the other 9%", "+$900"],
              ["Friday’s fee", "−$2"],
            ]}
            result={["Hermee loses only", "−$302"]}
          />
        </div>

        <P>
          The <B>$900 arrives in her wallet automatically</B>, in USDT, right after Monday’s opening price is published. She still owns her 50 shares, so if Nvidia recovers during the week she gets all of that back too.
        </P>
        <P>
          And on the other 50 or so weekends of the year when nothing dramatic happens? She loses the $2 and keeps every dollar of whatever the stock did. If Nvidia opens <B>4% higher</B>, she’s up $400 − $2 = <B>$398</B>. Protection never takes away the good weekends.
        </P>

        <Sum
          title="The whole rule, in one line"
          tone="held"
          lines={[
            ["how far it fell, beyond the line", "12% − 3% = 9%"],
            ["times the amount protected", "9% × $10,000"],
            ["capped at 20% of the amount", "most it can pay = $2,000"],
          ]}
          result={["Payout", "$900"]}
        />
        <P>Try it yourself. Drag Monday anywhere and watch the three numbers change:</P>
        <MondaySimulator ticker="NVDA" amount={10000} lineBps={300} cost={2} showLinePicker={false} className="max-w-3xl" />
      </Chapter>

      {/* ------------------------------------------------ I.3 */}
      <Chapter id="story-kip" n="I.3" title="How Kip makes money">
        <P>
          Someone has to pay Hermee the $900. That’s <B>Kip</B>. Kip has <B>$10,000 in USDT</B> sitting idle and would like it to earn something. He puts it into the <B>protection pool</B> together with nine other people, so the pool holds <B>$100,000</B>.
        </P>
        <Scene who="kip" time="How the pool keeps itself safe">
          Half of the pool, <B>$50,000</B>, is a <B>safety reserve</B> that is never used to back protection. The other $50,000 is the working half. Every protection sold locks away its maximum possible payout (20% of the amount), so the working half can back at most <B>$250,000</B> of stock (because 20% of $250,000 = $50,000). The pool can never promise more than it can pay.
        </Scene>

        <Sum
          title="A normal weekend for the pool"
          tone="keeper"
          lines={[
            ["Stock protected this weekend", "$250,000"],
            ["Average fee ≈ $5 per $10,000", "+$125"],
            ["Payouts (usually none)", "$0"],
          ]}
          result={["Pool earns", "+$125"]}
        />
        <Sum
          title="A year for the pool (from 21 years of history)"
          tone="keeper"
          lines={[
            ["Fees: $125 × 52 weekends", "+$6,500"],
            ["Paid back on bad Mondays (≈ 57%)", "−$3,700"],
            ["Interest on the idle USDT (≈ 4%)", "+$4,000"],
          ]}
          result={["Pool earns about", "+$6,800 (≈ 7%)"]}
        />
        <P>
          Kip owns a tenth of the pool, so his share of a typical year is about <B>$680 on his $10,000</B>, or around 7%. Our 21-year backtest found 7.3% a year across all of 2005–2026 and about 10% since 2015. That’s the deal Kip is taking: collect a little every week, and pay out on the rare bad Monday.
        </P>
        <Scene who="kip" time="The bad weekend">
          In March 2020 the US Federal Reserve cut rates to zero in an emergency on a Sunday evening, and most stocks opened 10–13% lower on Monday. For a pool like this one, that weekend’s payouts came to about <B>6.5% of everything it protected</B>: roughly $16,000. Kip’s share of that is about <B>$1,600</B>, a real loss, and it comes out of the working half, never the reserve.
        </Scene>
        <P>
          Afterwards the pool automatically <B>sells less protection</B> until it earns its way back, because its working half is smaller. That’s the rule that stopped the pool from being wiped out on any start date in 21 years of history, including starting in January 2020.
        </P>
      </Chapter>

      {/* ------------------------------------------------ I.4 */}
      <Chapter id="story-under" n="I.4" title="What happens underneath">
        <P>Behind the one button there are five steps. None of them needs Hermee or Kip to do anything.</P>
        <ol className="max-w-3xl space-y-4">
          {[
            {
              h: "1. The price is worked out from real weekends",
              p: (
                <>
                  Our engine has studied <B>61,815 real weekends</B> across 50 stocks since 2005. It looks at how often weekends like this one (for a stock this jumpy right now) ended past Hermee’s line, and by how much. Say that in weeks like this, <B>1 weekend in 100</B> dropped 8%, which is 5% past a 3% line. On $10,000 that’s a $500 payout once every 100 weekends, so the <B>fair price is $5 per weekend</B>. We charge 1.5× that, <B>$7.50</B>, and the extra is what keeps the pool safe in years like 2020. (Hermee paid only $2 in our story because Nvidia was calm that week; jumpy weeks cost more.)
                </>
              ),
            },
            { h: "2. The price is signed", p: <>Our server signs the price with a key, the way a bank stamps a quote. The contract on the blockchain only accepts prices that carry that signature and haven’t expired, so nobody can invent a cheaper one.</> },
            { h: "3. The payout money is locked", p: <>When Hermee confirms, her fee goes into the pool and <B>$2,000</B> (20% of her $10,000) is locked there for her. Kip can’t withdraw it until the weekend is over.</> },
            { h: "4. Friday 4 pm: sales close, the price is recorded", p: <>At the bell, no more protection can be bought for that weekend: after the close, news starts to leak into futures markets, and it wouldn’t be fair to the pool. The official Friday closing price, <B>$200</B>, is recorded.</> },
            { h: "5. Monday 9:30 am: settle", p: <>The official Monday opening price, <B>$176</B>, is recorded. The contract does the sum from section I.2 (fall of 12%, minus the 3% line, times $10,000 = <B>$900</B>), sends it to Hermee, and unlocks the remaining $1,100 back to the pool. If the stock had a split over the weekend, the weekend is cancelled and Hermee gets her fee back.</> },
          ].map((s) => (
            <li key={s.h} className="rounded-2xl border border-line bg-surface-2 p-5">
              <div className="font-semibold text-ink">{s.h}</div>
              <p className="mt-1.5 leading-relaxed text-ink-2">{s.p}</p>
            </li>
          ))}
        </ol>
        <P>
          One detail matters more than it looks: we always use the <B>official exchange price</B>, never the token’s own weekend price. Weekend token markets are thin, and we measured that the token discovers almost none of Monday’s move until Monday morning. Using the official price means nobody can push the token around to trigger a payout.
        </P>
      </Chapter>

      {/* ------------------------------------------------ I.5 */}
      <Chapter id="story-honest" n="I.5" title="The honest part">
        <ul className="max-w-3xl space-y-3">
          {[
            <>Most weekends Hermee pays a small fee and gets nothing back. Over years, on calm stocks like an S&amp;P 500 fund, that costs a little more than it returns. It’s worth it mainly on jumpy stocks, and for the weekends that would really hurt.</>,
            <>The payout is capped at 20% of the amount. A 50% crash would still leave a loss beyond that.</>,
            <>It covers the gap to Monday’s <i>opening</i> price. A fall later on Monday isn’t covered.</>,
            <>Kip can lose money on a bad weekend, and a few times in 21 years the pool paid out more in a year than it collected.</>,
            <>Right now this runs on test networks with free test tokens. The admin can pause things and move funds.</>,
          ].map((t, i) => (
            <li key={i} className="flex gap-3 text-[17px] leading-[1.7] text-ink-2">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gap" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="max-w-3xl rounded-2xl border border-floor/30 bg-floor-soft p-5 text-[15px] leading-relaxed text-ink-2">
          <B>That’s the whole idea.</B> Hermee pays a little to never have a catastrophic Monday. Kip earns a little every week for carrying that risk across many people and many stocks. Part II explains how we know the numbers above are realistic: where the data came from, how we tested it, and where it could be wrong.
        </div>
      </Chapter>
    </div>
  );
}
