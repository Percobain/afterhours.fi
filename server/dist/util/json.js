"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonReplacer = jsonReplacer;
exports.stringifySafe = stringifySafe;
exports.toPlain = toPlain;
/** JSON replacer that stringifies bigints (Express `json replacer` setting + manual stringify). */
function jsonReplacer(_key, value) {
    return typeof value === "bigint" ? value.toString() : value;
}
function stringifySafe(v, space) {
    return JSON.stringify(v, jsonReplacer, space);
}
/** Deep-converts bigints to strings so the value can be stored in Mongo or logged. */
function toPlain(v) {
    return JSON.parse(stringifySafe(v));
}
//# sourceMappingURL=json.js.map