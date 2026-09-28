import pino from "pino";

const level = process.env.LOG_LEVEL || "info";
const pretty = process.env.NODE_ENV !== "production" && process.env.LOG_PRETTY !== "0";

let transport: pino.TransportSingleOptions | undefined;
if (pretty) {
  try {
    require.resolve("pino-pretty");
    transport = { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } };
  } catch {
    transport = undefined;
  }
}

export const logger = pino({ level, ...(transport ? { transport } : {}) });
export type Logger = typeof logger;
