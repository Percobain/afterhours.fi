"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_OFFSET_SECONDS = exports.WEEK = exports.DAY = void 0;
exports.nowSec = nowSec;
exports.nextFridayClose = nextFridayClose;
exports.expectedOpenFor = expectedOpenFor;
exports.nextMondayOpen = nextMondayOpen;
exports.iso = iso;
exports.isMondayUtc = isMondayUtc;
exports.fmtDay = fmtDay;
exports.DAY = 86_400;
exports.WEEK = 7 * exports.DAY;
/** expectedOpen = epochId + 65.5h (Friday 20:00 UTC -> Monday 13:30 UTC). */
exports.OPEN_OFFSET_SECONDS = 65.5 * 3600;
function nowSec() {
    return Math.floor(Date.now() / 1000);
}
/**
 * Next Friday close at `closeHourUtc` (default 20:00 UTC = 16:00 New York on daylight time).
 * Mirrors contracts/scripts/deploy.ts so epochIds agree with the ones opened on-chain.
 */
function nextFridayClose(fromSec = nowSec(), closeHourUtc = 20) {
    const from = new Date(fromSec * 1000);
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), closeHourUtc, 0, 0));
    let add = (5 - d.getUTCDay() + 7) % 7;
    if (add === 0 && fromSec * 1000 > d.getTime())
        add = 7;
    d.setUTCDate(d.getUTCDate() + add);
    return Math.floor(d.getTime() / 1000);
}
function expectedOpenFor(epochId) {
    return Math.floor(epochId + exports.OPEN_OFFSET_SECONDS);
}
/** Next Monday 13:30 UTC strictly after `fromSec` (fallback when the market API is unreachable). */
function nextMondayOpen(fromSec = nowSec()) {
    const from = new Date(fromSec * 1000);
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 13, 30, 0));
    let add = (1 - d.getUTCDay() + 7) % 7;
    if (add === 0 && fromSec * 1000 > d.getTime())
        add = 7;
    d.setUTCDate(d.getUTCDate() + add);
    return Math.floor(d.getTime() / 1000);
}
function iso(sec) {
    if (sec === null || sec === undefined || !Number.isFinite(sec))
        return null;
    return new Date(sec * 1000).toISOString();
}
function isMondayUtc(sec = nowSec()) {
    return new Date(sec * 1000).getUTCDay() === 1;
}
function fmtDay(sec) {
    return new Date(sec * 1000).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}
//# sourceMappingURL=time.js.map