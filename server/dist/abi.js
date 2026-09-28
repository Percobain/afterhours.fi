"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockERC20Abi = exports.ReferenceOracleAbi = exports.KeeperVaultAbi = exports.CoverMarketAbi = void 0;
// ABIs are copied from ../shared/abi by scripts/copy-abi.mjs into src/abi/*.ts (as const) so the build is self-contained.
var index_1 = require("./abi/index");
Object.defineProperty(exports, "CoverMarketAbi", { enumerable: true, get: function () { return index_1.CoverMarketAbi; } });
Object.defineProperty(exports, "KeeperVaultAbi", { enumerable: true, get: function () { return index_1.KeeperVaultAbi; } });
Object.defineProperty(exports, "ReferenceOracleAbi", { enumerable: true, get: function () { return index_1.ReferenceOracleAbi; } });
Object.defineProperty(exports, "MockERC20Abi", { enumerable: true, get: function () { return index_1.MockERC20Abi; } });
//# sourceMappingURL=abi.js.map