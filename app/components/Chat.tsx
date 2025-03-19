'use client'

import { useState } from 'react'
import { useXmtp } from '../hooks/useXmtp'

interface Message {
  senderAddress: string
  content: string
  sent: Date
}

export default function Chat() {
  const [recipientAddress, setRecipientAddress] = useState('')
  const [message, setMessage] = useState('')
  const { connect, disconnect, sendMessage, messages, isConnected, startChat, conversations, error } = useXmtp()

  return (
    <div className="flex flex-col min-h-screen p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">XMTP Chat</h1>
        {!isConnected ? (
          <button
            onClick={connect}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Connect Wallet
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Disconnect
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {isConnected && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="Enter recipient's Ethereum address"
              className="flex-1 p-2 border rounded"
            />
            <button
              onClick={() => startChat(recipientAddress)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Start Chat
            </button>
          </div>

          <div className="flex-1 min-h-[400px] border rounded p-4 mb-4 overflow-y-auto">
            {messages.map((msg: Message, index: number) => (
              <div
                key={index}
                className={`mb-2 p-2 rounded ${
                  msg.senderAddress === window.ethereum?.selectedAddress
                    ? 'bg-blue-100 ml-auto'
                    : 'bg-gray-100'
                }`}
              >
                <div className="text-sm text-gray-500">{msg.senderAddress}</div>
                <div>{msg.content}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message"
              className="flex-1 p-2 border rounded"
            />
            <button
              onClick={() => {
                sendMessage(message)
                setMessage('')
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 