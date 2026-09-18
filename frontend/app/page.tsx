'use client'

import { useState } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
  useReadContract,
} from 'wagmi'
import { injected } from 'wagmi/connectors'
import { isAddress, maxUint256, parseUnits, formatUnits } from 'viem'
import { CONTRACT_ADDRESS, CONTRACT_ABI, ERC20_ABI } from '@/lib/contract'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  const [recipient, setRecipient] = useState('')
  const [token, setToken] = useState('')
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('30')
  const [message, setMessage] = useState('')

  const { writeContract: approveToken, isPending: isApproving } = useWriteContract()
  const { writeContract: createAllowance, isPending: isCreating } = useWriteContract()
  const { writeContract: cancelAllowance, isPending: isCanceling } = useWriteContract()

  const recipientAddress = recipient.trim()
  const tokenAddress = token.trim()
  const validAddresses = isAddress(recipientAddress) && isAddress(tokenAddress)
  const validAmount = amount.trim() !== '' && Number(amount) > 0
  const validDays = days.trim() !== '' && Number(days) >= 1

  const { data: allowanceData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getAllowance',
    args:
      isConnected && address && validAddresses
        ? [address, recipientAddress, tokenAddress]
        : undefined,
    query: { enabled: isConnected && !!address && validAddresses },
  })

  const getAmountAndPeriod = () => {
    if (!validAmount || !validDays) {
      throw new Error('Enter a valid amount and a period of at least 1 day.')
    }
    return {
      amountInWei: parseUnits(amount, 18),
      periodInSeconds:
        BigInt(Math.floor(Number(days))) * BigInt(24 * 60 * 60),
    }
  }

  const handleApprove = () => {
    if (!isAddress(tokenAddress)) {
      setMessage('Enter a valid ERC20 token address first.')
      return
    }

    try {
      getAmountAndPeriod()
      approveToken({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, maxUint256],
      })
      setMessage('Approve transaction sent. Confirm it in your wallet.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid approval details.')
    }
  }

  const handleCreate = () => {
    if (!isAddress(recipientAddress) || !isAddress(tokenAddress)) {
      setMessage('Enter valid recipient and token addresses.')
      return
    }

    try {
      const { amountInWei, periodInSeconds } = getAmountAndPeriod()
      createAllowance({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'createAllowance',
        args: [recipientAddress, tokenAddress, amountInWei, periodInSeconds],
      })
      setMessage('Allowance transaction sent. Confirm it in your wallet.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid allowance details.')
    }
  }

  const handleCancel = () => {
    if (!isAddress(recipientAddress) || !isAddress(tokenAddress)) {
      setMessage('Enter valid recipient and token addresses.')
      return
    }

    cancelAllowance({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'cancelAllowance',
      args: [recipientAddress, tokenAddress],
    })
    setMessage('Cancel transaction sent. Confirm it in your wallet.')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Recurring Payments</h1>
        <p className="text-center text-gray-500 mb-8">Manage your crypto subscriptions securely.</p>

        {!isConnected ? (
          <button
            onClick={() => connect({ connector: injected() })}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg">
              <span className="text-sm text-gray-600">Connected:</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <button onClick={() => disconnect()} className="text-red-500 text-sm hover:underline">Disconnect</button>
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">Create New Allowance</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Recipient Address (0x...)" value={recipient} onChange={e => setRecipient(e.target.value)} className="p-3 border rounded-lg" />
                <input type="text" placeholder="Token Address (0x...)" value={token} onChange={e => setToken(e.target.value)} className="p-3 border rounded-lg" />
                <input type="number" min="0" step="any" placeholder="Amount (18 decimals)" value={amount} onChange={e => setAmount(e.target.value)} className="p-3 border rounded-lg" />
                <input type="number" min="1" step="1" placeholder="Period in Days" value={days} onChange={e => setDays(e.target.value)} className="p-3 border rounded-lg" />
              </div>

              {recipient && token && amount && days && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <p className="font-bold mb-1">You are approving:</p>
                  <p>Withdrawal of <b>{amount} tokens</b> every <b>{days} days</b> to <b>{recipient.slice(0, 10)}...</b></p>
                  <p className="text-xs mt-1 text-green-600">Approve the token first, then create the allowance.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isApproving ? 'Confirm Approval...' : '1. Approve Token'}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                >
                  {isCreating ? 'Confirm Allowance...' : '2. Create Allowance'}
                </button>
              </div>
              {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
            </div>

            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">Cancel Allowance</h2>
              <p className="text-sm text-gray-500 mb-3">Enter the recipient and token details to cancel an active subscription.</p>
              <button
                onClick={handleCancel}
                disabled={isCanceling}
                className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition disabled:opacity-50"
              >
                {isCanceling ? 'Confirm in Wallet...' : 'Cancel Allowance'}
              </button>
            </div>

            {allowanceData && (
              <div className="border-t pt-6">
                <h2 className="text-xl font-semibold mb-4">Current Allowance Status</h2>
                <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto">
                  {JSON.stringify({
                    amount: formatUnits(allowanceData[0], 18),
                    period_days: Number(allowanceData[1]) / 86400,
                    isActive: allowanceData[3],
                    next_withdraw: new Date(Number(allowanceData[4]) * 1000).toLocaleString(),
                  }, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
