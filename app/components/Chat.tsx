'use client'

import { useState, useEffect } from 'react'
import { useXmtp } from '../hooks/useXmtp'
import { ethers } from 'ethers'
import { ConnectBar } from './chat/layout/ConnectBar'
import { Header } from './chat/layout/Header'
import { Footer } from './chat/layout/Footer'
import { DisconnectedState } from './chat/DisconnectedState'
import { MessageList } from './chat/MessageList'
import { MessageInput } from './chat/MessageInput'
import { Message, Conversation } from '../types/chat'
import { SharedNFTsList } from './chat/SharedNFTsList'
import { CopyableAddress } from './common/CopyableAddress'
import { TokenGroupManager } from './chat/TokenGroupManager'

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
    markConversationAsRead
  } = useXmtp()
  
  const [recipientAddress, setRecipientAddress] = useState('')
  const [displayAddress, setDisplayAddress] = useState('')
  const [message, setMessage] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [currentMessages, setCurrentMessages] = useState<Message[]>([])
  const [isSelecting, setIsSelecting] = useState(false)

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

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientAddress || !isValidEthAddress(recipientAddress)) return;
    await startChat(recipientAddress)
    setRecipientAddress('')
    setDisplayAddress('')
  }

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

            <div className="mb-4">
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
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  setRecipientAddress(pastedText);
                  setDisplayAddress(truncateAddress(pastedText));
                }}
              />
              <button
                onClick={handleStartChat}
                className={`mt-2 w-full ${
                  !recipientAddress || !isValidEthAddress(recipientAddress)
                    ? 'bg-yellow-100 text-yellow-500 opacity-60 cursor-not-allowed'
                    : 'btn-primary'
                }`}
                disabled={!recipientAddress || !isValidEthAddress(recipientAddress)}
              >
                Start Chat
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <h2 className="font-semibold mb-2">Recent Chats</h2>
              <div className="flex-1 overflow-y-auto space-y-2">
                {conversations.map((conversation) => {
                  const conversationKey = getUniqueConversationKey(conversation);
                  const isSelected = selectedConversationId === conversationKey;
                  
                  return (
                    <div
                      key={conversationKey}
                      onClick={() => !isSelecting && selectConversation(conversation)}
                      className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 relative mb-2 min-h-[68px]
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
                    </div>
                  );
                })}
              </div>
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