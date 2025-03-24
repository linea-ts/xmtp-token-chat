'use client'

import { useState, useEffect } from 'react'
import { useXmtp } from '../hooks/useXmtp'
import { ethers } from 'ethers'
import { ConnectBar } from './chat/layout/ConnectBar'
import { Header } from './chat/layout/Header'
import { Footer } from './chat/layout/Footer'
import { DisconnectedState } from './chat/DisconnectedState'
import { GroupCreationModal } from './chat/GroupCreationModal'
import { MessageList } from './chat/MessageList'
import { MessageInput } from './chat/MessageInput'
import { Message, Conversation } from '../types/chat'
import { SharedNFTsList } from './chat/SharedNFTsList'

const truncateEthAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

function ChatContent() {
  const { connect, disconnect, sendMessage, startChat, createGroup, messages, conversations, isConnected, error, setConversations, isLoading, setIsLoading, isSwitchingChat } = useXmtp()
  const [recipientAddress, setRecipientAddress] = useState('')
  const [message, setMessage] = useState('')
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [currentMessages, setCurrentMessages] = useState<Message[]>([])

  const getUniqueConversationKey = (conversation: Conversation) => {
    if (conversation.groupMetadata) {
      return `${conversation.id}:${conversation.peerAddress.toLowerCase()}`;
    }
    return conversation.id;
  };

  const selectConversation = async (conversation: Conversation) => {
    const conversationKey = getUniqueConversationKey(conversation);
    
    // If already selected, do nothing
    if (selectedConversationId === conversationKey) {
      return;
    }

    setSelectedConversationId(conversationKey);
    setCurrentMessages([]);
    await startChat(conversation.peerAddress);
  };

  useEffect(() => {
    if (selectedConversationId && messages) {
      setCurrentMessages(messages);
    }
  }, [messages, selectedConversationId]);

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

  const handleDisconnect = async () => {
    setIsLoading(true);
    await handleConnect();
  };

  const getMessageId = (msg: Message, index: number) => {
    return `${msg.senderAddress}-${msg.sent?.getTime() || Date.now()}-${index}`;
  };

  if (!isConnected) {
    return <DisconnectedState isLoading={isLoading} onConnect={handleConnect} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ConnectBar 
        address={(window as any).ethereum?.selectedAddress || ''}
        onDisconnect={handleDisconnect}
      />

      <Header onCreateGroup={() => setShowGroupModal(true)} />

      <div className="flex-1 container mx-auto p-4">
        <div className="grid grid-cols-3 gap-4">
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
                  const conversationKey = getUniqueConversationKey(conversation);
                  const isSelected = selectedConversationId === conversationKey;
                  
                  return (
                    <div
                      key={conversationKey}
                      onClick={() => selectConversation(conversation)}
                      className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${
                        isSelected ? 'bg-yellow-50 border-2 border-yellow-500' : 'border border-gray-200'
                      } flex justify-between items-center`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate">
                            {conversation.groupMetadata?.name || truncateEthAddress(conversation.peerAddress)}
                          </div>
                          {conversation.groupMetadata && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                              {conversation.groupMetadata.members.length} members
                            </span>
                          )}
                        </div>
                        {conversation.groupMetadata && (
                          <div className="text-sm text-gray-500 truncate mt-1">
                            Members: {conversation.groupMetadata.members.map(m => truncateEthAddress(m)).join(', ')}
                          </div>
                        )}
                        {conversation.sharedNFTs && conversation.sharedNFTs.length > 0 && (
                          <div className="mt-1 text-left">
                            <SharedNFTsList nfts={conversation.sharedNFTs} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="col-span-2 border rounded p-4 flex flex-col h-[calc(100vh-200px)] bg-gray-100">
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

      <GroupCreationModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onSubmit={handleCreateGroup}
        groupName={groupName}
        setGroupName={setGroupName}
        groupMembers={groupMembers}
        setGroupMembers={setGroupMembers}
      />

      <Footer />
    </div>
  );
}

export default ChatContent;