'use client'

import { useState, useEffect, useRef } from 'react'
import { useXmtp } from '../hooks/useXmtp'
import { ethers } from 'ethers'
import { ConnectBar } from './chat/layout/ConnectBar'
import { Header } from './chat/layout/Header'
import { Footer } from './chat/layout/Footer'
import { DisconnectedState } from './chat/DisconnectedState'
import { MessageList } from './chat/MessageList'
import { MessageInput } from './chat/MessageInput'
import { Message, Conversation } from '../types/chat'
import { CopyableAddress } from './common/CopyableAddress'
import { TokenGroupManager } from './chat/TokenGroupManager'
import { SharedNFTsPreview } from './chat/SharedNFTsPreview'

function ChatContent() {
  const { 
    connect, 
    disconnect, 
    sendMessage, 
    startChat, 
    conversations, 
    isConnected, 
    error, 
    isLoading, 
    isSwitchingChat,
    setIsSwitchingChat,
    userNFTs,
    availableGroupChats,
    toggleGroupChat,
    markConversationAsRead,
    isLoadingConversations,
    deleteConversation
  } = useXmtp()
  
  const [recipientAddress, setRecipientAddress] = useState('')
  const [displayAddress, setDisplayAddress] = useState('')
  const [message, setMessage] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [currentMessages, setCurrentMessages] = useState<Message[]>([])
  const [isSelecting, setIsSelecting] = useState(false)
  const [startChatError, setStartChatError] = useState<string | null>(null)
  const startChatTimeoutRef = useRef<NodeJS.Timeout>()
  const [activeTab, setActiveTab] = useState<'direct' | 'group'>('direct')

  const getUniqueConversationKey = (conversation: Conversation) => {
    if (conversation.groupMetadata) {
      return `${conversation.id}:${conversation.peerAddress.toLowerCase()}`;
    }
    return conversation.id;
  };

  useEffect(() => {
    if (!selectedConversationId) return;
    
    const selectedConv = conversations.find(conv => 
      getUniqueConversationKey(conv) === selectedConversationId
    );
    
    if (selectedConv) {
      setCurrentMessages(selectedConv.messages);
    }
  }, [selectedConversationId, conversations]);

  const selectConversation = async (conversation: Conversation) => {
    const conversationKey = getUniqueConversationKey(conversation);
    
    if (selectedConversationId === conversationKey || isSelecting) {
      return;
    }

    try {
      setIsSelecting(true);
      setSelectedConversationId(conversationKey);
      setCurrentMessages(conversation.messages);
      setIsSwitchingChat(true);
      
      markConversationAsRead(conversationKey);
      
      await new Promise(resolve => setTimeout(resolve, 450));
      await startChat(conversation.peerAddress);
    } catch (error) {
      console.error('Error selecting conversation:', error);
      setSelectedConversationId(null);
      setCurrentMessages([]);
    } finally {
      setIsSwitchingChat(false);
      setIsSelecting(false);
    }
  };

  const handleConnect = async () => {
    await connect()
  }

  const truncateAddress = (address: string) => {
    if (address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`
    }
    return address
  }

  const isValidEthAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleStartChat = async () => {
    if (!isValidEthAddress(recipientAddress)) {
      setStartChatError('Please enter a valid wallet address');
      setRecipientAddress('');
      setDisplayAddress('');
      
      // Clear error after 3 seconds
      if (startChatTimeoutRef.current) {
        clearTimeout(startChatTimeoutRef.current);
      }
      startChatTimeoutRef.current = setTimeout(() => {
        setStartChatError(null);
      }, 3000);
      
      return;
    }

    try {
      setStartChatError(null);
      await startChat(recipientAddress);
      setRecipientAddress('');
      setDisplayAddress('');
    } catch (error: any) {
      // Preserve the specific error messages from useXmtp.ts
      setStartChatError(error.message || 'Unable to start chat. Please try again.');
      // Clear the input form on error
      setRecipientAddress('');
      setDisplayAddress('');
      
      if (startChatTimeoutRef.current) {
        clearTimeout(startChatTimeoutRef.current);
      }
      startChatTimeoutRef.current = setTimeout(() => {
        setStartChatError(null);
      }, 3000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const newMessage = {
      content: message,
      senderAddress: (window as any).ethereum?.selectedAddress,
      sent: new Date()
    };
    
    setCurrentMessages(prev => [...prev, newMessage]);
    await sendMessage(message);
    setMessage('');
  };

  const getMessageId = (msg: Message, index: number) => {
    return `${msg.senderAddress}-${msg.sent?.getTime() || Date.now()}-${index}`;
  };

  useEffect(() => {
    return () => {
      if (startChatTimeoutRef.current) {
        clearTimeout(startChatTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedConversationId(null);
        setCurrentMessages([]);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleDeleteConversation = (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation(); // Prevent conversation selection
    
    const groupName = conversation.groupMetadata?.name;
    deleteConversation(conversation.peerAddress, groupName);
    
    // If this was the selected conversation, clear it
    if (selectedConversationId === getUniqueConversationKey(conversation)) {
      setSelectedConversationId(null);
      setCurrentMessages([]);
    }
  };

  if (!isConnected) {
    return <DisconnectedState isLoading={isLoading} onConnect={handleConnect} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <ConnectBar 
        address={(window as any).ethereum?.selectedAddress || ''}
        onDisconnect={disconnect}
      />

      <Header />

      {/* Add error toast outside of the main content area */}
      {startChatError && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 min-w-[300px] m-4">
          <div className="p-4 bg-red-100 font-semibold text-red-700 text-sm rounded-md shadow-lg border border-red-200 animate-fade-in">
            {startChatError}
          </div>
        </div>
      )}

      <div className="flex-1 container mx-auto px-4 pb-2 pt-2 min-h-0">
        <div className="grid grid-cols-3 gap-4 h-full">
          <div className="col-span-1 border rounded p-3 flex flex-col overflow-hidden">
            <div className="flex mb-4 border-b">
              <button
                onClick={() => setActiveTab('direct')}
                className={`flex items-center justify-center flex-1 px-4 py-2 border-b-2 ${
                  activeTab === 'direct'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
                Direct Messages
              </button>
              <button
                onClick={() => setActiveTab('group')}
                className={`flex items-center justify-center flex-1 px-4 py-2 border-b-2 ${
                  activeTab === 'group'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                Group Chats
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              {activeTab === 'direct' ? (
                <div className="h-full flex flex-col">
                  <div className="mb-4 relative flex-shrink-0">
                    <input
                      type="text"
                      placeholder="Enter wallet address"
                      className="w-full p-2 border rounded"
                      value={displayAddress}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setRecipientAddress(newValue);
                        setDisplayAddress(truncateAddress(newValue));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleStartChat();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData('text');
                        setRecipientAddress(pastedText);
                        setDisplayAddress(truncateAddress(pastedText));
                      }}
                    />
                    <button
                      onClick={handleStartChat}
                      disabled={!isValidEthAddress(recipientAddress)}
                      className={`mt-2 w-full btn-primary ${
                        !isValidEthAddress(recipientAddress) 
                          ? 'opacity-50 cursor-not-allowed' 
                          : ''
                      }`}
                    >
                      Start Chat
                    </button>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    {isLoadingConversations ? (
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent"></div>
                        <p className="text-gray-500 text-lg">Loading conversations...</p>
                      </div>
                    ) : (
                      <div className="h-full overflow-y-auto">
                        {conversations.map((conversation) => {
                          const conversationKey = getUniqueConversationKey(conversation);
                          const isSelected = selectedConversationId === conversationKey;
                          
                          return (
                            <div
                              key={conversationKey}
                              onClick={() => !isSelecting && selectConversation(conversation)}
                              className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 relative mb-2 min-h-[68px] group
                                ${isSelected ? 'bg-yellow-50 border-2 border-yellow-500' : 'border border-gray-200'}
                                ${conversation.unreadCount > 0 ? 'bg-blue-50' : ''}`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium">
                                      {conversation.groupMetadata?.name || 
                                        <CopyableAddress address={conversation.peerAddress} />
                                      }
                                    </div>
                                    {conversation.unreadCount > 0 && (
                                      <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                        {conversation.unreadCount}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => handleDeleteConversation(e, conversation)}
                                    className="p-1 hover:bg-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete conversation"
                                  >
                                    <svg 
                                      xmlns="http://www.w3.org/2000/svg" 
                                      className="h-5 w-5 text-red-500" 
                                      viewBox="0 0 20 20" 
                                      fill="currentColor"
                                    >
                                      <path 
                                        fillRule="evenodd" 
                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                                        clipRule="evenodd" 
                                      />
                                    </svg>
                                  </button>
                                </div>
                                
                                {conversation.sharedNFTs && (
                                  <div className="mt-1">
                                    <SharedNFTsPreview nfts={conversation.sharedNFTs} />
                                  </div>
                                )}
                                
                                {conversation.preview && (
                                  <div className="text-sm text-gray-500 truncate mt-1">
                                    {conversation.preview}
                                  </div>
                                )}
                                {conversation.lastMessageTimestamp && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    {new Date(conversation.lastMessageTimestamp).toLocaleString('en-US', {
                                      month: 'numeric',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto">
                  <TokenGroupManager
                    userNFTs={userNFTs}
                    availableGroupChats={availableGroupChats}
                    onToggleGroup={toggleGroupChat}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="col-span-2 border rounded p-3 flex flex-col min-h-0 bg-gray-100">
            {/* Move the error message to be fixed positioned */}
            {error && (
              <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 min-w-[300px] m-4">
                <div className="p-4 bg-red-100 font-semibold text-red-700 text-sm rounded-md shadow-lg border border-red-200 animate-fade-in">
                  {error}
                </div>
              </div>
            )}
            
            <MessageList 
              messages={currentMessages}
              getMessageId={getMessageId}
              isSwitchingChat={isSwitchingChat}
            />

            <MessageInput
              message={message}
              setMessage={setMessage}
              onSubmit={handleSendMessage}
            />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default ChatContent;