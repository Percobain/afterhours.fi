// Generated from shared/abi/ReferenceOracle.json by scripts/gen-abi.mjs. Do not edit.
export const ReferenceOracleAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner_",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AlreadyPosted",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotKeeper",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroPrice",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "epochId",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "uint128",
        "name": "price",
        "type": "uint128"
      }
    ],
    "name": "ClosePosted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "epochId",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "EpochVoided",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "keeper",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "allowed",
        "type": "bool"
      }
    ],
    "name": "KeeperSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint128",
        "name": "price",
        "type": "uint128"
      }
    ],
    "name": "LastPriceUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "epochId",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "uint128",
        "name": "price",
        "type": "uint128"
      }
    ],
    "name": "OpenPosted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint64",
        "name": "epochId",
        "type": "uint64"
      }
    ],
    "name": "getRef",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint128",
            "name": "closePrice",
            "type": "uint128"
          },
          {
            "internalType": "uint128",
            "name": "openPrice",
            "type": "uint128"
          },
          {
            "internalType": "uint64",
            "name": "closeAt",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "openAt",
            "type": "uint64"
          },
          {
            "internalType": "bool",
            "name": "voided",
            "type": "bool"
          },
          {
            "internalType": "string",
            "name": "voidReason",
            "type": "string"
          }
        ],
        "internalType": "struct ReferenceOracle.EpochRef",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint64",
        "name": "epochId",
        "type": "uint64"
      }
    ],
    "name": "isSettleable",
    "outputs": [
      {
        "internalType": "bool",
        "name": "settled",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "voided",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "keepers",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "lastPrice",
    "outputs": [
      {
        "internalType": "uint128",
        "name": "",
        "type": "uint128"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "lastPriceAt",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint64",
        "name": "epochId",
        "type": "uint64"
      },
      {
        "internalType": "uint128",
        "name": "price",
        "type": "uint128"
      }
    ],
    "name": "postClose",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "tokens",
        "type": "address[]"
      },
      {
        "internalType": "uint64",
        "name": "epochId",
        "type": "uint64"
      },
      {
        "internalType": "uint128[]",
        "name": "prices",
        "type": "uint128[]"
      }
    ],
    "name": "postCloseBatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint64",
        "name": "epochId",
        "type": "uint64"
      },
      {
        "internalType": "uint128",
        "name": "price",
        "type": "uint128"
      }
    ],
    "name": "postOpen",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "tokens",
        "type": "address[]"
      },
      {
        "internalType": "uint64",
        "name": "epochId",
        "type": "uint64"
      },
      {
        "internalType": "uint128[]",
        "name": "prices",
        "type": "uint128[]"
      }
    ],
    "name": "postOpenBatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "keeper",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "allowed",
        "type": "bool"
      }
    ],
    "name": "setKeeper",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint128",
        "name": "price",
        "type": "uint128"
      }
    ],
    "name": "setLastPrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "tokens",
        "type": "address[]"
      },
      {
        "internalType": "uint128[]",
        "name": "prices",
        "type": "uint128[]"
      }
    ],
    "name": "setLastPrices",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint64",
        "name": "epochId",
        "type": "uint64"
      },
      {
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "voidEpoch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
