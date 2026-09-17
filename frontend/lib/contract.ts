export const CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_CONTRACT_ADDRESS_HERE"; // ⚠️ ضع عنوان عقدك هنا بعد النشر

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
