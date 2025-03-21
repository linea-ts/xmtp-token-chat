'use client'

import { useState, useEffect } from 'react'
import { useXmtp } from '../hooks/useXmtp'
import { ethers } from 'ethers'
import { addDeletedChat, isConversationDeleted, getDeletedChats } from '../utils/deletedChats'
import { ConnectBar } from './chat/layout/ConnectBar'
import { Header } from './chat/layout/Header'
import { Footer } from './chat/layout/Footer'

interface Message {
  id?: string;
  senderAddress: string
  content: string
  sent: Date
}

interface Conversation {
  id?: string;
  peerAddress: string;
  messages: Message[];
  groupMetadata?: {
    name: string;
    members: string[];
  };
  preview?: string;
  lastMessage?: string;
}

const truncateEthAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

function ChatContent() {
  const { connect, disconnect, sendMessage, startChat, createGroup, messages, conversations, isConnected, error, setConversations } = useXmtp()
  const [recipientAddress, setRecipientAddress] = useState('')
  const [message, setMessage] = useState('')
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<any>(null)
  const [currentMessages, setCurrentMessages] = useState<Message[]>([])

  // Filter out deleted conversations on mount and when conversations change
  useEffect(() => {
    const filteredConversations = conversations.filter(conv => !isConversationDeleted(
      conv.peerAddress,
      conv.groupMetadata?.name
    ));
    if (filteredConversations.length !== conversations.length) {
      setConversations(filteredConversations);
    }
  }, [conversations]);

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

  const selectConversation = async (conversation: Conversation) => {
    // Clear current messages before loading new ones
    setCurrentMessages([]);
    setSelectedConversation(conversation);
    // Load messages for the selected conversation
    if (conversation) {
      await startChat(conversation.peerAddress);
      setCurrentMessages(messages || []);
    }
  };

  // Update messages when they change
  useEffect(() => {
    if (selectedConversation) {
      setCurrentMessages(messages)
    }
  }, [messages, selectedConversation])

  const handleDisconnect = () => {
    handleConnect(); // This toggles the connection state
  };

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add a function to generate truly unique conversation IDs
  const getConversationId = (conversation: Conversation) => {
    if (conversation.groupMetadata?.name) {
      return `group-${conversation.groupMetadata.name}-${conversation.peerAddress}`;
    }
    return `chat-${conversation.peerAddress}`;
  };

  // Add a function to generate unique message IDs
  const getMessageId = (msg: Message, index: number) => {
    if (msg.id) return msg.id;
    return `${msg.senderAddress}-${msg.sent?.getTime() || Date.now()}-${index}`;
  };

  const handleDeleteChat = (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation(); // Prevent chat selection when clicking delete
    
    // Add to localStorage
    addDeletedChat(
      conversation.peerAddress,
      conversation.groupMetadata?.name
    );

    // Update UI
    const updatedConversations = conversations.filter(c => 
      conversation.groupMetadata 
        ? c.groupMetadata?.name !== conversation.groupMetadata?.name
        : c.peerAddress !== conversation.peerAddress
    );

    // If the deleted chat was selected, clear the selection
    if (selectedConversation && 
      (selectedConversation.peerAddress === conversation.peerAddress ||
      selectedConversation.groupMetadata?.name === conversation.groupMetadata?.name)) {
      setSelectedConversation(null);
      setCurrentMessages([]);
    }

    setConversations(updatedConversations);
  };

  // Add a tooltip to explain deletion is local only
  const deleteButtonTooltip = "Delete chat (only hidden locally)";

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col">
        
        <div className="flex-1 flex flex-col items-center justify-center p-4">
        <img 
                src="/Screenshotbg.png" 
                alt="Disconnected State" 
                className="pl-4 mx-auto mb-8 w-[240px] h-auto"
              />
          <div className="w-full max-w-5xl">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="section_headline__nyvPb flex items-center">
                  <span className="section_icon__QAGu9">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" className="w-12 h-12">
                      <circle cx="16" cy="16" r="16" fill="rgb(255 228 85)"></circle>
                      <g fill="#121212">
                        <path d="M22.218 22.914H9.333V9.338h2.948v10.945h9.937v2.631M22.219 11.967a2.63 2.63 0 1 0 0-5.26 2.63 2.63 0 0 0 0 5.26"></path>
                      </g>
                    </svg>
                  </span>
                  <h3 className="section_title__llN6N text-4xl font-bold ml-4">TokenChat</h3>
                </div>
              </div>
              <p className="text-xl text-gray-600">Connect with fellow memecoin/NFT holders on Linea! the fastest and cheapest zkEVM chain.</p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleConnect}
                className="btn-primary text-lg px-8 py-3 rounded-[40px]"
              >
                Login with Your Wallet
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Wallet Status Bar */}
      <ConnectBar 
        address={(window as any).ethereum?.selectedAddress || ''}
        onDisconnect={handleDisconnect}
      />

      {/* Header */}
      <Header onCreateGroup={() => setShowGroupModal(true)} />

      {/* Main Content */}
      <div className="flex-1 container mx-auto p-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Left sidebar */}
          <div className="col-span-1 border rounded p-4">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Enter wallet address"
                className="w-full p-2 border rounded"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
              />
              <button
                onClick={handleStartChat}
                className="mt-2 w-full btn-primary"
              >
                Start Chat
              </button>
            </div>

            <div>
              <h2 className="font-semibold mb-2">Recent Chats</h2>
              <div className="space-y-2">
                {conversations.map((conversation) => {
                  const isSelected = selectedConversation && 
                    (conversation.groupMetadata 
                      ? selectedConversation.groupMetadata?.name === conversation.groupMetadata?.name
                      : selectedConversation.peerAddress === conversation.peerAddress);
                  
                  return (
                    <div
                      key={getConversationId(conversation)}
                      onClick={() => selectConversation(conversation)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-100 ${
                        isSelected
                          ? 'bg-yellow-50 border-2 border-yellow-300'
                          : 'border border-gray-200'
                      } flex justify-between items-center group`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {conversation.groupMetadata?.name || truncateEthAddress(conversation.peerAddress)}
                        </div>
                        {conversation.groupMetadata ? (
                          <div className="text-sm text-gray-500">
                            {conversation.groupMetadata.members.length} members
                          </div>
                        ) : null}
                      </div>
                      <button
                        onClick={(e) => handleDeleteChat(e, conversation)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 hover:bg-red-100 rounded"
                        title={deleteButtonTooltip}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chat area */}
          <div className="col-span-2 border rounded p-4 flex flex-col h-[calc(100vh-200px)] bg-gray-100">
            {error && <div className="text-red-500 mb-4">{error}</div>}
            
            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
              {currentMessages.map((msg, index) => {
                const isMyMessage = msg.senderAddress === (window as any).ethereum?.selectedAddress;
                const messageTime = new Date(msg.sent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const messageDate = new Date(msg.sent).toLocaleDateString();
                
                return (
                  <div
                    key={getMessageId(msg, index)}
                    className="flex flex-col w-full"
                  >
                    <div
                      className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} w-full mb-4`}
                    >
                      <div
                        className={`p-3 rounded-2xl shadow-sm max-w-[80%] break-words
                          ${isMyMessage ? 'bg-yellow-50' : 'bg-white'}`}
                      >
                        <div className="text-xs text-gray-500 mb-1">{truncateEthAddress(msg.senderAddress)}</div>
                        <div className="mb-1">{msg.content}</div>
                        <div className="text-xs text-gray-400">{messageTime} • {messageDate}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2 bg-white p-2 rounded">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message"
                className="flex-1 p-2 border rounded"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (message.trim()) {
                      handleSendMessage(e);
                    }
                  }
                }}
              />
              <button
                type="submit"
                className="btn-primary whitespace-nowrap"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Group Creation Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  className="btn-primary"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}

// Client-side only wrapper
export default function Chat() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return <ChatContent />;
}