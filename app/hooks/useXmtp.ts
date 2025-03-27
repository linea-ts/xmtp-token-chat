'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Client, Conversation as XMTPConversation, DecodedMessage, Stream } from '@xmtp/xmtp-js'
import { ethers } from 'ethers'
import { switchToLinea, validateLineaNetwork, setupNetworkMonitoring } from '../utils/chainValidation'
import { TokenInfo, getAllNFTs, hasMatchingNFTs, getSharedNFTs } from '../utils/tokenUtils'
import { Message, Conversation } from '../types/chat'

interface ConversationData {
  id: string
  peerAddress: string
  messages: Message[]
  preview: string
  lastMessage: string
  groupMetadata?: {
    name: string
    members: string[]
  }
  unreadCount: number
  lastMessageTimestamp: number
  sharedNFTs: TokenInfo[]
}

export function useXmtp() {
  const [client, setClient] = useState<Client | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<XMTPConversation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSwitchingChat, setIsSwitchingChat] = useState(false)
  const [userNFTs, setUserNFTs] = useState<TokenInfo[]>([])
  const [availableGroupChats, setAvailableGroupChats] = useState<{
    contractAddress: string
    name: string
    joined: boolean
  }[]>([])
  const initializingRef = useRef(false)
  const [wasDisconnected, setWasDisconnected] = useState(false)
  const [tokenGroups, setTokenGroups] = useState<{
    [contractAddress: string]: {
      name: string
      members: string[]
    }
  }>({})
  const streamsRef = useRef<Map<string, Stream<DecodedMessage>>>(new Map())
  const conversationStreamRef = useRef<any>(null)
  const nftCacheRef = useRef<{
    [address: string]: {
      nfts: TokenInfo[];
      timestamp: number;
    };
  }>({})
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)

  const disconnect = useCallback(async () => {
    // Clean up conversation stream
    if (conversationStreamRef.current) {
      conversationStreamRef.current[Symbol.asyncIterator]().return?.()
    }
    
    // Clean up all message streams
    for (const stream of streamsRef.current.values()) {
      stream[Symbol.asyncIterator]().return?.()
    }
    streamsRef.current.clear()
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('xmtp-keys')
      localStorage.removeItem('xmtp-client-state')
      localStorage.setItem('xmtp-disconnected', 'true')
    }
    
    setWasDisconnected(true)
    setClient(null)
    setIsConnected(false)
    setMessages([])
    setConversations([])
    setCurrentConversation(null)
    setError(null)
    setIsLoading(false)
  }, [])

  const connect = useCallback(async () => {
    if (initializingRef.current || client) {
      return
    }

    if (!window.ethereum) {
      setError('Please install MetaMask to use this app')
      return
    }

    try {
      initializingRef.current = true
      setIsLoading(true)
      
      localStorage.removeItem('xmtp-disconnected')
      setWasDisconnected(false)

      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      
      try {
        await validateLineaNetwork(provider)
      } catch (error) {
        await switchToLinea()
        const updatedProvider = new ethers.providers.Web3Provider(window.ethereum)
        await validateLineaNetwork(updatedProvider)
      }
      
      const signer = provider.getSigner()
      const { Client } = await import('@xmtp/xmtp-js')
      
      if (!isConnected) {
        const xmtp = await Client.create(signer, { env: 'production' })
        setClient(xmtp)
        setIsConnected(true)
        setError(null)
        await loadConversations(xmtp)
        await setupConversationStream(xmtp)
      }

    } catch (error: any) {
      console.error('Error connecting to XMTP:', error)
      setError(error.message || 'Failed to connect to XMTP')
      setIsConnected(false)
      setClient(null)
    } finally {
      setIsLoading(false)
      initializingRef.current = false
    }
  }, [client, isConnected])

  useEffect(() => {
    if (isConnected) {
      setupNetworkMonitoring(async () => {
        setError('Wrong network detected. Switching to Linea...')
        try {
          await switchToLinea()
          const provider = new ethers.providers.Web3Provider(window.ethereum as any)
          await validateLineaNetwork(provider)
          setError(null)
        } catch (error: any) {
          console.error('Failed to switch network:', error)
          setError('Please switch to Linea network to continue')
          await disconnect()
        }
      })
    }
  }, [isConnected])

  useEffect(() => {
    const checkPersistedConnection = async () => {
      const wasExplicitlyDisconnected = localStorage.getItem('xmtp-disconnected') === 'true'
      
      if (
        typeof window === 'undefined' || 
        !window.ethereum || 
        client || 
        initializingRef.current ||
        wasExplicitlyDisconnected ||
        wasDisconnected
      ) return
      
      // Only attempt auto-connect if we already have a connected account
      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (!accounts || accounts.length === 0) return
      
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum)
        await validateLineaNetwork(provider)
        if (!initializingRef.current) {
          await connect()
        }
      } catch (error) {
        console.error('Failed to restore connection:', error)
      }
    }

    checkPersistedConnection()
  }, [client, connect, wasDisconnected])

  const markConversationAsRead = useCallback((conversationId: string) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unreadCount: 0 }
          : conv
      )
    )
  }, [])

  const getCachedNFTs = async (address: string) => {
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    const cached = nftCacheRef.current[address];
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.nfts;
    }

    const nfts = await getAllNFTs(address);
    nftCacheRef.current[address] = {
      nfts,
      timestamp: Date.now()
    };
    
    return nfts;
  };

  const handleNewStreamMessage = useCallback(async (msg: DecodedMessage, peerAddress: string) => {
    if (!client) return

    const userAddress = await client.address
    const userNFTs = await getCachedNFTs(userAddress)
    const peerNFTs = await getCachedNFTs(peerAddress)
    const sharedNFTs = getSharedNFTs(userNFTs, peerNFTs)

    if (sharedNFTs.length === 0) {
      // If no shared NFTs, don't process the message
      return
    }

    const newMessage = {
      senderAddress: msg.senderAddress,
      content: msg.content as string,
      sent: msg.sent,
    }
    
    const isFromMe = msg.senderAddress.toLowerCase() === client?.address?.toLowerCase()
    
    setMessages(prevMessages => {
      const messageExists = prevMessages.some(m => 
        m.senderAddress === newMessage.senderAddress && 
        m.content === newMessage.content &&
        Math.abs(m.sent.getTime() - newMessage.sent.getTime()) < 5000
      )
      if (messageExists) return prevMessages
      return [...prevMessages, newMessage]
    })

    setConversations(prevConvs => {
      const updatedConvs = prevConvs.map(conv => {
        if (conv.peerAddress.toLowerCase() === peerAddress.toLowerCase()) {
          const messageExists = conv.messages.some(m => 
            m.senderAddress === newMessage.senderAddress && 
            m.content === newMessage.content &&
            Math.abs(m.sent.getTime() - newMessage.sent.getTime()) < 5000
          )
          if (messageExists) return conv

          const shouldIncrementUnread = !isFromMe && 
            currentConversation?.peerAddress.toLowerCase() !== peerAddress.toLowerCase()

          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            preview: msg.content as string,
            lastMessage: msg.content as string,
            lastMessageTimestamp: msg.sent.getTime(),
            unreadCount: shouldIncrementUnread ? (conv.unreadCount || 0) + 1 : conv.unreadCount || 0
          }
        }
        return conv
      })
      
      // Sort conversations by most recent message
      return updatedConvs.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0))
    })
  }, [client?.address, currentConversation])

  const getConversationId = (peerAddress: string, topic: string, isGroup = false) => {
    return isGroup ? `group:${peerAddress}` : `direct:${peerAddress.toLowerCase()}:${topic}`;
  };

  const startChat = useCallback(async (addressInput: string) => {
    if (!client) return null
    
    try {
      const peerAddress = ethers.utils.getAddress(addressInput).toLowerCase()
      const userAddress = await client.address
      
      if (peerAddress === userAddress.toLowerCase()) {
        throw new Error("Cannot start conversation with yourself")
      }

      // Check for shared NFTs
      const userNFTs = await getCachedNFTs(userAddress)
      const peerNFTs = await getCachedNFTs(peerAddress)
      const sharedNFTs = getSharedNFTs(userNFTs, peerNFTs)

      if (sharedNFTs.length === 0) {
        throw new Error("You do not share any tokens with this address")
      }

      // Create or get existing conversation
      const conversation = await client.conversations.newConversation(peerAddress)
      setCurrentConversation(conversation)

      const messages = await conversation.messages()
      const newConversation: Conversation = {
        id: `direct:${peerAddress}:${conversation.topic}`,
        peerAddress,
        messages: messages.map(msg => ({
          senderAddress: msg.senderAddress,
          content: msg.content as string,
          sent: msg.sent,
        })),
        preview: messages[messages.length - 1]?.content as string || '',
        lastMessage: messages[messages.length - 1]?.content as string || '',
        sharedNFTs,
        unreadCount: 0,
        lastMessageTimestamp: messages[messages.length - 1]?.sent.getTime() || Date.now(),
      }

      setConversations(prev => [...prev, newConversation])
      await setupStreamForConversation(conversation)
      
      return messages
    } catch (error: any) {
      console.error('Error starting chat:', error)
      throw error
    }
  }, [client])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!client || !currentConversation) {
      setError('No active conversation')
      return false
    }

    try {
      await currentConversation.send(content)
      return true
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message')
      return false
    }
  }, [client, currentConversation])

  const selectConversation = useCallback(async (conversationId: string) => {
    if (!client) return

    try {
      const conversation = conversations.find(c => c.id === conversationId)
      if (!conversation) {
        throw new Error('Conversation not found')
      }

      // Get or create the XMTP conversation
      const xmtpConversation = await client.conversations.newConversation(
        conversation.peerAddress
      )
      setCurrentConversation(xmtpConversation)
      
      // Set up message stream if not already set up
      await setupStreamForConversation(xmtpConversation)
      
      return conversation
    } catch (error) {
      console.error('Error selecting conversation:', error)
      setError('Failed to select conversation')
      return null
    }
  }, [client, conversations])

  const joinTokenGroup = useCallback(async (contractAddress: string) => {
    if (!client) {
      setError('Please connect your wallet first')
      return
    }

    try {
      const groupId = `group:${contractAddress}`
      const tokenInfo = userNFTs.find(nft => 
        nft.contractAddress.toLowerCase() === contractAddress.toLowerCase()
      )

      // Create a new XMTP conversation with group metadata
      const group = await client.conversations.newConversation(
        contractAddress,
        {
          conversationId: groupId,
          metadata: {
            name: tokenInfo?.contractName || `Token Holders: ${contractAddress}`,
            description: `Group chat for holders of tokens from contract ${contractAddress}`,
            members: JSON.stringify([]),
            type: 'token_group'
          }
        }
      )

      const newGroup: Conversation = {
        id: groupId,
        peerAddress: contractAddress,
        messages: [],
        groupMetadata: {
          name: tokenInfo?.contractName || `Token Holders: ${contractAddress}`,
          members: [],
          type: 'token_group'
        },
        preview: '',
        lastMessage: '',
        unreadCount: 0,
        lastMessageTimestamp: Date.now(),
      }

      // Set up stream for the group
      await setupStreamForConversation(group)

      setConversations(prev => [...prev, newGroup])
      return group
    } catch (error) {
      console.error('Error joining token group:', error)
      setError('Failed to join token group')
    }
  }, [client, userNFTs])

  const loadConversations = async (xmtp: Client) => {
    setIsLoadingConversations(true)
    try {
      const allConversations = await xmtp.conversations.list()
      const userAddress = await xmtp.address
      const userNFTs = await getCachedNFTs(userAddress)
      
      const validConversations: ConversationData[] = []

      // Process conversations in batches to avoid too many concurrent requests
      const BATCH_SIZE = 5;
      for (let i = 0; i < allConversations.length; i += BATCH_SIZE) {
        const batch = allConversations.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (conversation) => {
            const peerAddress = conversation.peerAddress.toLowerCase()
            
            if (peerAddress === userAddress.toLowerCase()) return null;

            const peerNFTs = await getCachedNFTs(peerAddress)
            const sharedNFTs = getSharedNFTs(userNFTs, peerNFTs)
            
            if (sharedNFTs.length === 0) return null;

            const messages = await conversation.messages()
            return {
              id: `direct:${peerAddress}:${conversation.topic}`,
              peerAddress,
              messages: messages.map(msg => ({
                senderAddress: msg.senderAddress,
                content: msg.content as string,
                sent: msg.sent,
              })),
              preview: messages[messages.length - 1]?.content as string || '',
              lastMessage: messages[messages.length - 1]?.content as string || '',
              sharedNFTs,
              unreadCount: 0,
              lastMessageTimestamp: messages[messages.length - 1]?.sent.getTime() || Date.now(),
            };
          })
        );

        validConversations.push(...batchResults.filter(Boolean) as ConversationData[]);
      }

      // Remove duplicates
      const uniqueConversations = validConversations.reduce((acc, current) => {
        const exists = acc.find(conv => 
          conv.peerAddress.toLowerCase() === current.peerAddress.toLowerCase()
        )
        if (!exists) {
          acc.push(current)
        }
        return acc
      }, [] as ConversationData[])

      setConversations(uniqueConversations)
    } catch (error) {
      console.error('Error loading conversations:', error)
      setError('Failed to load conversations')
    } finally {
      setIsLoadingConversations(false)
    }
  }

  const toggleGroupChat = useCallback(async (contractAddress: string) => {
    const group = availableGroupChats.find(g => g.contractAddress === contractAddress)
    if (!group) return

    try {
      if (group.joined) {
        // Leave group
        const conversation = conversations.find(c => 
          c.peerAddress.toLowerCase() === contractAddress.toLowerCase()
        )
        if (conversation && client) {
          const allConversations = await client.conversations.list()
          const xmtpGroup = allConversations?.find(conv => conv.context?.conversationId === conversation.id)
          if (xmtpGroup) {
            // Update the members list in metadata to remove the current user
            const currentMembers = JSON.parse(xmtpGroup.context?.metadata?.members || '[]')
            const updatedMembers = currentMembers.filter((member: string) => member !== client.address)
            
            // Create a new conversation with updated metadata
            await client.conversations.newConversation(
              contractAddress,
              {
                conversationId: conversation.id,
                metadata: {
                  ...xmtpGroup.context?.metadata,
                  members: JSON.stringify(updatedMembers)
                }
              }
            )
          }
        }
        
        setAvailableGroupChats(prev => 
          prev.map(g => g.contractAddress === contractAddress ? {...g, joined: false} : g)
        )
        setConversations(prev => 
          prev.filter(c => c.peerAddress.toLowerCase() !== contractAddress.toLowerCase())
        )
      } else {
        // Join group
        const newGroup = await joinTokenGroup(contractAddress)
        if (newGroup) {
          setAvailableGroupChats(prev => 
            prev.map(g => g.contractAddress === contractAddress ? {...g, joined: true} : g)
          )
        }
      }
    } catch (error) {
      console.error('Error toggling group chat:', error)
      setError('Failed to toggle group chat membership')
    }
  }, [availableGroupChats, conversations, client, joinTokenGroup])

  const manageGroupMembership = useCallback(async (group: any, contractAddress: string) => {
    if (!client) return

    try {
      const userAddress = await client.address
      const currentNFTs = await getAllNFTs(userAddress)
      
      const hasToken = currentNFTs.some(nft => 
        nft.contractAddress.toLowerCase() === contractAddress.toLowerCase()
      )

      const isCurrentlyMember = group.members().some((member: any) => 
        member.inboxId === userAddress
      )

      if (hasToken && !isCurrentlyMember) {
        await group.addMembers([userAddress])
      } else if (!hasToken && isCurrentlyMember) {
        await group.removeMembers([userAddress])
        
        setConversations(prev => 
          prev.filter(conv => conv.id !== `group:${contractAddress}`)
        )
      }
    } catch (error) {
      console.error('Error managing group membership:', error)
    }
  }, [client])

  const setupStreamForConversation = async (conversation: XMTPConversation) => {
    const streamKey = conversation.topic // or another unique identifier
    
    // Clean up existing stream if it exists
    if (streamsRef.current.has(streamKey)) {
      streamsRef.current.get(streamKey)?.[Symbol.asyncIterator]().return?.()
    }
    
    const stream = await conversation.streamMessages()
    streamsRef.current.set(streamKey, stream)
    
    const handleNewMessages = async () => {
      try {
        for await (const msg of stream) {
          handleNewStreamMessage(msg, conversation.peerAddress)
        }
      } catch (error) {
        console.error('Error in message stream:', error)
      }
    }

    handleNewMessages()
  }

  const setupConversationStream = async (xmtp: Client) => {
    try {
      if (conversationStreamRef.current) {
        conversationStreamRef.current[Symbol.asyncIterator]().return?.()
      }

      conversationStreamRef.current = await xmtp.conversations.stream()
      
      const handleNewConversations = async () => {
        try {
          for await (const conversation of conversationStreamRef.current) {
            const peerAddress = conversation.peerAddress.toLowerCase()
            const isGroup = conversation.context?.conversationId?.startsWith('group:')
            const conversationId = getConversationId(peerAddress, conversation.topic, isGroup)

            // More thorough duplicate check
            const existingConversation = conversations.find(conv => 
              conv.peerAddress.toLowerCase() === peerAddress || 
              conv.id === conversationId
            )

            if (existingConversation) {
              // Update existing conversation stream
              await setupStreamForConversation(conversation)
              continue
            }

            // For 1-on-1 chats
            if (!isGroup) {
              const userAddress = await xmtp.address
              const userNFTs = await getAllNFTs(userAddress)
              const peerNFTs = await getAllNFTs(peerAddress)
              const sharedNFTs = getSharedNFTs(userNFTs, peerNFTs)

              if (sharedNFTs.length === 0) continue // Skip if no shared NFTs

              const messages = await conversation.messages()
              const newConversation: ConversationData = {
                id: `direct:${peerAddress}:${conversation.topic}`,
                peerAddress: peerAddress,
                messages: messages.map((msg: DecodedMessage) => ({
                  senderAddress: msg.senderAddress,
                  content: msg.content as string,
                  sent: msg.sent,
                })),
                preview: messages[messages.length - 1]?.content as string || '',
                lastMessage: messages[messages.length - 1]?.content as string || '',
                sharedNFTs,
                unreadCount: 0,
                lastMessageTimestamp: messages[messages.length - 1]?.sent.getTime() || Date.now(),
              }

              setConversations(prev => {
                // Final duplicate check before adding
                if (prev.some(conv => conv.peerAddress.toLowerCase() === peerAddress)) return prev
                return [...prev, newConversation]
              })

              await setupStreamForConversation(conversation)
            }
          }
        } catch (error) {
          console.error('Error in conversation stream:', error)
        }
      }

      handleNewConversations()
    } catch (error) {
      console.error('Error setting up conversation stream:', error)
    }
  }

  useEffect(() => {
    return () => {
      if (conversationStreamRef.current) {
        conversationStreamRef.current[Symbol.asyncIterator]().return?.()
      }
      for (const stream of streamsRef.current.values()) {
        stream[Symbol.asyncIterator]().return?.()
      }
      streamsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!isConnected || !client) return

    const checkTokenOwnership = async () => {
      const userAddress = await client.address
      const currentNFTs = await getAllNFTs(userAddress)
      setUserNFTs(currentNFTs)

      // Update available group chats
      setAvailableGroupChats(currentNFTs.map(token => ({
        contractAddress: token.contractAddress,
        name: token.contractName || `Token Holders: ${token.contractAddress}`,
        joined: conversations.some(conv => 
          conv.groupMetadata?.type === 'token_group' && 
          conv.peerAddress.toLowerCase() === token.contractAddress.toLowerCase()
        )
      })))

      // Check membership for all token groups
      for (const conversation of conversations) {
        if (conversation.groupMetadata?.type === 'token_group') {
          const allConversations = await client.conversations.list()
          const group = allConversations.find(conv => 
            conv.context?.conversationId === conversation.id
          )
          if (group) {
            await manageGroupMembership(group, conversation.peerAddress)
          }
        }
      }
    }

    const interval = setInterval(checkTokenOwnership, 5 * 60 * 1000) // Check every 5 minutes
    checkTokenOwnership() // Initial check

    return () => clearInterval(interval)
  }, [isConnected, client, conversations, manageGroupMembership])

  const setupGroupPermissions = async (group: any) => {
    // By default, use ADMIN_ONLY permissions
    // This means only admins can add/remove members
    if (client?.address) {
      // Group creator becomes super admin by default
      // Set initial permissions for token-based groups
      await group.addAdmin(client.address)
    }
  }

  useEffect(() => {
    const clearCache = () => {
      nftCacheRef.current = {};
    };

    // Clear cache when disconnecting
    if (!isConnected) {
      clearCache();
    }

    return () => {
      clearCache();
    };
  }, [isConnected]);

  return {
    connect,
    disconnect,
    handleSendMessage,
    startChat,
    joinTokenGroup,
    messages,
    conversations,
    setConversations,
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
    selectConversation,
  } as const
} 