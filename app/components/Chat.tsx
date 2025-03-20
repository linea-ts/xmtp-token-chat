'use client'

import { useState, useEffect } from 'react'
import { useXmtp } from '../hooks/useXmtp'
import { ethers } from 'ethers'

interface Message {
  senderAddress: string
  content: string
  sent: Date
}

function ChatContent() {
  const { connect, disconnect, sendMessage, startChat, createGroup, messages, conversations, isConnected, error } = useXmtp()
  const [recipientAddress, setRecipientAddress] = useState('')
  const [message, setMessage] = useState('')
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState('')

  const handleConnect = async () => {
    if (isConnected) {
      disconnect()
    } else {
      await connect()
    }
  }

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault()
    await startChat(recipientAddress)
    setRecipientAddress('')
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendMessage(message)
    setMessage('')
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    const members = groupMembers.split(',').map(addr => addr.trim())
    if (members.some(addr => !ethers.utils.isAddress(addr))) {
      alert('Please enter valid Ethereum addresses')
      return
    }
    await createGroup(members, groupName)
    setShowGroupModal(false)
    setGroupName('')
    setGroupMembers('')
  }

  if (!isConnected) {
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
          <div className="flex justify-center">
            <button
              onClick={handleConnect}
              className="bg-yellow-300 hover:bg-yellow-400 text-black font-bold px-8 py-3 rounded-[40px] text-lg transition-colors"
            >
              Login with Your Wallet
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={handleConnect}
          style={{ backgroundColor: 'rgb(71 221 253)' }}
          className="hover:bg-[#47ddfd]/80 text-black font-bold py-2 px-4 rounded"
        >
          Disconnect
        </button>
        <button
          onClick={() => setShowGroupModal(true)}
          className="bg-yellow-300 hover:bg-yellow-400 text-black font-bold py-2 px-4 rounded"
        >
          Create Group
        </button>
      </div>

      {/* Group Creation Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Create Group Chat</h2>
            <form onSubmit={handleCreateGroup}>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group Name"
                className="w-full p-2 mb-4 border rounded"
                required
              />
              <textarea
                value={groupMembers}
                onChange={(e) => setGroupMembers(e.target.value)}
                placeholder="Member addresses (comma separated)"
                className="w-full p-2 mb-4 border rounded h-24"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-yellow-300 hover:bg-yellow-400 text-black font-bold py-2 px-4 rounded"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 h-[calc(100vh-200px)]">
        {/* Conversations List */}
        <div className="col-span-1 border rounded p-4 flex flex-col">
          <div className="mb-4">
            <form onSubmit={handleStartChat} className="flex gap-2">
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Enter wallet address"
                className="flex-1 p-2 border rounded text-sm"
              />
              <button
                type="submit"
                className="bg-yellow-300 hover:bg-yellow-400 text-black px-4 py-2 rounded text-sm"
              >
                Start Chat
              </button>
            </form>
          </div>

          <h2 className="font-semibold mb-2">Recent Chats</h2>
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv, index) => (
              <div
                key={index}
                onClick={() => startChat(conv.peerAddress)}
                className="p-3 hover:bg-gray-50 rounded mb-2 cursor-pointer"
              >
                {conv.isGroup ? (
                  <div>
                    <div className="font-medium">{conv.groupMetadata?.name}</div>
                    <div className="text-sm text-gray-500">
                      {conv.groupMetadata?.members.length} members
                    </div>
                  </div>
                ) : (
                  <div className="font-medium truncate">{conv.peerAddress}</div>
                )}
                {conv.messages.length > 0 && (
                  <div className="text-sm text-gray-500 truncate">
                    {conv.messages[conv.messages.length - 1].content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="col-span-2 border rounded p-4 flex flex-col">
          {error && <div className="text-red-500 mb-4">{error}</div>}

          <div className="flex-1 overflow-y-auto mb-4 space-y-2">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`p-2 rounded ${
                  msg.senderAddress === (window as any).ethereum?.selectedAddress
                    ? 'bg-yellow-100 ml-auto'
                    : 'bg-gray-100'
                } max-w-[80%] break-words`}
              >
                <div className="text-xs text-gray-500 mb-1">{msg.senderAddress}</div>
                <div>{msg.content}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage}>
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message"
                className="flex-1 p-2 border rounded"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (message.trim()) {
                      handleSendMessage(e)
                    }
                  }
                }}
              />
              <button
                type="submit"
                className="bg-yellow-300 hover:bg-yellow-400 text-black px-4 py-2 rounded"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Client-side only wrapper
export default function Chat() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return <ChatContent />
} 