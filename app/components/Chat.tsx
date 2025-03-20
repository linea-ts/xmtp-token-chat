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
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="text-4xl font-bold bg-yellow-300 p-4 rounded-lg">L•</div>
            <h1 className="text-4xl font-bold ml-4">TokenChat</h1>
          </div>
          <p className="text-xl text-gray-600">Connect with fellow memecoin/NFT holders.</p>
        </div>

        {!isConnected ? (
          <div className="flex justify-center mb-4">
            <button
              onClick={connect}
              className="bg-yellow-300 hover:bg-yellow-400 text-black font-bold px-8 py-3 rounded-[40px] text-lg transition-colors"
            >
              Login with Your Wallet
            </button>
          </div>
        ) : (
          <div className="flex gap-4 h-[calc(100vh-300px)] bg-white rounded-lg shadow-lg">
            {/* Conversations Sidebar */}
            <div className="w-1/3 border-r p-4 flex flex-col gap-2">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="Enter wallet address"
                  className="flex-1 p-2 border rounded-lg text-sm"
                />
                <button
                  onClick={() => startChat(recipientAddress)}
                  className="bg-yellow-300 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Start Chat
                </button>
              </div>
              
              <h2 className="font-semibold mb-2">Recent Chats</h2>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <p className="text-gray-500 text-sm">No conversations yet</p>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.peerAddress}
                      onClick={() => startChat(conv.peerAddress)}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg mb-2 transition-colors"
                    >
                      <div className="font-medium truncate">{conv.peerAddress}</div>
                      {conv.messages.length > 0 && (
                        <div className="text-sm text-gray-500 truncate">
                          {conv.messages[conv.messages.length - 1].content}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col p-4">
              <div className="flex-1 overflow-y-auto mb-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`mb-2 p-3 rounded-lg max-w-[80%] ${
                      msg.senderAddress === window.ethereum?.selectedAddress
                        ? 'bg-yellow-100 ml-auto'
                        : 'bg-gray-100'
                    }`}
                  >
                    <div className="text-xs text-gray-500 mb-1">{msg.senderAddress}</div>
                    <div className="break-words">{msg.content}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message"
                  className="flex-1 p-3 border rounded-lg"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (message.trim()) {
                        sendMessage(message);
                        setMessage('');
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (message.trim()) {
                      sendMessage(message);
                      setMessage('');
                    }
                  }}
                  className="bg-yellow-300 hover:bg-yellow-400 text-black px-6 py-3 rounded-lg transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mt-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
      </div>
    </div>
  )
} 