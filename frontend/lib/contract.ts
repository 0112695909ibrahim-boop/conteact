export const CONTRACT_ADDRESS = "0xD78480b7eEF2ECd2187f1e51BF5644C6b4C5D1bC";

export const CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "period", "type": "uint256" }
    ],
    "name": "createAllowance",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "address", "name": "token", "type": "address" }
    ],
    "name": "cancelAllowance",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "payer", "type": "address" },
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "address", "name": "token", "type": "address" }
    ],
    "name": "getAllowance",
    "outputs": [
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "period", "type": "uint256" },
      { "internalType": "uint256", "name": "lastWithdraw", "type": "uint256" },
      { "internalType": "bool", "name": "isActive", "type": "bool" },
      { "internalType": "uint256", "name": "nextWithdrawTime", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
