"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const level = process.env.LOG_LEVEL || "info";
const pretty = process.env.NODE_ENV !== "production" && process.env.LOG_PRETTY !== "0";
let transport;
if (pretty) {
    try {
        require.resolve("pino-pretty");
        transport = { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } };
    }
    catch {
        transport = undefined;
    }
}
exports.logger = (0, pino_1.default)({ level, ...(transport ? { transport } : {}) });
//# sourceMappingURL=logger.js.map