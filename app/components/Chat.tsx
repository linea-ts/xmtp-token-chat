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
    handleSendMessage,
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
    selectConversation: selectXmtpConversation
  } = useXmtp()
  
  const [recipientAddress, setRecipientAddress] = useState('')
  const [message, setMessage] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [currentMessages, setCurrentMessages] = useState<Message[]>([])
  const [isSelecting, setIsSelecting] = useState(false)
  const [startChatError, setStartChatError] = useState<string | null>(null)
  const startChatTimeoutRef = useRef<NodeJS.Timeout>()

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

  const handleConversationSelect = async (conversation: Conversation) => {
    const conversationKey = getUniqueConversationKey(conversation);
    
    if (selectedConversationId === conversationKey || isSelecting) {
      return;
    }

    try {
      setIsSelecting(true);
      setIsSwitchingChat(true);
      
      await selectXmtpConversation(conversation.id);
      
      setSelectedConversationId(conversationKey);
      setCurrentMessages(conversation.messages);
      markConversationAsRead(conversationKey);
      
      await new Promise(resolve => setTimeout(resolve, 450));
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

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await startChat(recipientAddress)
      if (result) {
        setRecipientAddress('')
        setStartChatError(null)
      }
    } catch (error: any) {
      setStartChatError(error.message || 'Failed to start chat')
      if (startChatTimeoutRef.current) {
        clearTimeout(startChatTimeoutRef.current)
      }
      startChatTimeoutRef.current = setTimeout(() => {
        setStartChatError(null)
      }, 3000)
    }
  }

  const handleSendMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const newMessage = {
      content: message,
      senderAddress: (window as any).ethereum?.selectedAddress,
      sent: new Date()
    };
    
    const success = await handleSendMessage(message);
    if (success) {
      setCurrentMessages(prev => [...prev, newMessage]);
      setMessage('');
    }
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

      <div className="flex-1 container mx-auto px-4 pb-2 pt-2 min-h-0">
        <div className="grid grid-cols-3 gap-4 h-full">
          <div className="col-span-1 border rounded p-3 flex flex-col overflow-hidden">
            <TokenGroupManager
              userNFTs={userNFTs}
              availableGroupChats={availableGroupChats}
              onToggleGroup={toggleGroupChat}
            />

            <div className="mb-4 relative">
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
              {startChatError && (
                <div className="absolute left-0 right-0 mt-2 p-2 bg-red-100 text-red-700 text-sm rounded-md shadow-md animate-fade-in">
                  {startChatError}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <h2 className="font-semibold mb-2">Recent Chats</h2>
              {isLoadingConversations ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent"></div>
                  <p className="text-gray-500 text-lg">Loading conversations...</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {conversations.map((conversation) => {
                    const conversationKey = getUniqueConversationKey(conversation);
                    const isSelected = selectedConversationId === conversationKey;
                    
                    return (
                      <div
                        key={conversationKey}
                        onClick={() => !isSelecting && handleConversationSelect(conversation)}
                        className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 relative
                          ${isSelected ? 'bg-yellow-50 border-2 border-yellow-500' : 'border border-gray-200'}
                          ${conversation.unreadCount > 0 ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
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
                            {conversation.sharedNFTs && (
                              <SharedNFTsPreview nfts={conversation.sharedNFTs} />
                            )}
                            {conversation.preview && (
                              <div className="text-sm text-gray-500 truncate">
                                {conversation.preview}
                              </div>
                            )}
                            {conversation.lastMessageTimestamp && (
                              <div className="text-xs text-gray-400">
                                {new Date(conversation.lastMessageTimestamp).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-2 border rounded p-3 flex flex-col min-h-0 bg-gray-100">
            {error && <div className="text-red-500 mb-4">{error}</div>}
            
            <MessageList 
              messages={currentMessages}
              getMessageId={getMessageId}
              isSwitchingChat={isSwitchingChat}
            />

            <MessageInput
              message={message}
              setMessage={setMessage}
              onSubmit={handleSendMessageSubmit}
            />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default ChatContent;