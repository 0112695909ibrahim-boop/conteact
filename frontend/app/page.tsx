'use client'

import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useWriteContract, useReadContract } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { parseUnits, formatUnits } from 'viem'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/contract'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  
  // State for creating allowance
  const [recipient, setRecipient] = useState('')
  const [token, setToken] = useState('')
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('30')

  // Hooks for writing to the contract
  const { writeContract: createAllowance, isPending: isCreating } = useWriteContract()
  const { writeContract: cancelAllowance, isPending: isCanceling } = useWriteContract()

  // Hook for reading from the contract (Example: checking an allowance)
  const { data: allowanceData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getAllowance',
    args: isConnected ? [address as `0x${string}`, recipient as `0x${string}`, token as `0x${string}`] : undefined,
    query: { enabled: isConnected && !!recipient && !!token }
  })

  const handleCreate = () => {
    if (!recipient || !token || !amount || !days) return alert("Please fill all fields")
    
    // تحويل الأيام إلى ثواني
    const periodInSeconds = BigInt(parseInt(days)) * 24n * 60n * 60n
    // تحويل المبلغ إلى Wei (نفترض أن العملة بها 18 خانة عشرية، مثل USDC على بعض الشبكات أو ETH. إذا كانت USDC استخدم 6)
    const amountInWei = parseUnits(amount, 18) 

    createAllowance({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'createAllowance',
      args: [recipient as `0x${string}`, token as `0x${string}`, amountInWei, periodInSeconds],
    })
  }

  const handleCancel = () => {
    if (!recipient || !token) return alert("Please enter recipient and token to cancel")
    cancelAllowance({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'cancelAllowance',
      args: [recipient as `0x${string}`, token as `0x${string}`],
    })
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
            {/* معلومات المحفظة */}
            <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg">
              <span className="text-sm text-gray-600">Connected:</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <button onClick={() => disconnect()} className="text-red-500 text-sm hover:underline">Disconnect</button>
              </div>
            </div>

            {/* نموذج إنشاء اشتراك */}
            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">Create New Allowance</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Recipient Address (0x...)" value={recipient} onChange={e => setRecipient(e.target.value)} className="p-3 border rounded-lg" />
                <input type="text" placeholder="Token Address (0x...)" value={token} onChange={e => setToken(e.target.value)} className="p-3 border rounded-lg" />
                <input type="number" placeholder="Amount (e.g., 100)" value={amount} onChange={e => setAmount(e.target.value)} className="p-3 border rounded-lg" />
                <input type="number" placeholder="Period in Days (e.g., 30)" value={days} onChange={e => setDays(e.target.value)} className="p-3 border rounded-lg" />
              </div>

              {/* نافذة التوقيع الواضح (Clear Signing UI) */}
              {recipient && token && amount && days && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <p className="font-bold mb-1">🔒 You are approving:</p>
                  <p>Withdrawal of <b>{amount} Tokens</b> every <b>{days} days</b> to <b>{recipient.slice(0,10)}...</b></p>
                  <p className="text-xs mt-1 text-green-600">You can cancel this at any time.</p>
                </div>
              )}

              <button 
                onClick={handleCreate} 
                disabled={isCreating}
                className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {isCreating ? 'Confirm in Wallet...' : 'Approve & Create Allowance'}
              </button>
            </div>

            {/* إلغاء اشتراك */}
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

            {/* عرض بيانات الاشتراك (إن وجد) */}
            {allowanceData && (
              <div className="border-t pt-6">
                <h2 className="text-xl font-semibold mb-4">Current Allowance Status</h2>
                <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto">
                  {JSON.stringify({
                    amount: formatUnits(allowanceData[0], 18),
                    period_days: Number(allowanceData[1]) / 86400,
                    isActive: allowanceData[3],
                    next_withdraw: new Date(Number(allowanceData[4]) * 1000).toLocaleString()
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
