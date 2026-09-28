"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.errMsg = errMsg;
class ApiError extends Error {
    status;
    code;
    extra;
    constructor(status, code, message, extra) {
        super(message);
        this.status = status;
        this.code = code;
        this.extra = extra;
    }
}
exports.ApiError = ApiError;
function errMsg(e) {
    if (e instanceof Error)
        return e.message;
    return String(e);
}
//# sourceMappingURL=errors.js.map