"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fmtUsd = fmtUsd;
exports.fmtBarrier = fmtBarrier;
exports.fmtGap = fmtGap;
exports.receiptFor = receiptFor;
exports.statusTextFor = statusTextFor;
const time_1 = require("./util/time");
function fmtUsd(units) {
    const n = Number(BigInt(units)) / 1e6;
    const s = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return s.endsWith(".00") ? s.slice(0, -3) : s;
}
function fmtBarrier(bps) {
    const pct = bps / 100;
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}
function fmtGap(gapBps) {
    const pct = gapBps / 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
}
/** Plain-English Monday receipt for settled and refunded policies; null while the floor is still open. */
function receiptFor(p) {
    const name = p.tokenSymbol ?? p.ticker ?? "Your stock";
    if (p.status === "Refunded") {
        return `Weekend voided (${p.refundReason || "epoch voided"}). Premium $${fmtUsd(p.premiumUsd)} returned.`;
    }
    if (p.status !== "Settled")
        return null;
    const gap = p.gapBps ?? 0;
    const payout = BigInt(p.payoutUsd || "0");
    if (payout > 0n) {
        return `Floor paid $${fmtUsd(payout)}. ${name} opened ${fmtGap(gap)}; you were made whole below -${fmtBarrier(p.barrierBps)}.`;
    }
    return `Floor held. ${name} opened ${fmtGap(gap)} on Monday; your ${fmtBarrier(p.barrierBps)} floor was not needed. Premium $${fmtUsd(p.premiumUsd)}.`;
}
/** Short status line for the "My weekends" list. */
function statusTextFor(p) {
    const name = p.tokenSymbol ?? p.ticker ?? "your stock";
    switch (p.status) {
        case "Open":
            return `Floor set at -${fmtBarrier(p.barrierBps)} on ${name}. Settles at the Monday open (${(0, time_1.fmtDay)((0, time_1.expectedOpenFor)(p.epochId))}).`;
        case "Settled":
            return BigInt(p.payoutUsd || "0") > 0n ? `Floor paid $${fmtUsd(p.payoutUsd)}` : "Floor held";
        case "Refunded":
            return "Weekend voided, premium returned";
    }
}
//# sourceMappingURL=receipts.js.map