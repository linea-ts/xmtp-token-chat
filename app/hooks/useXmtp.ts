'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Client, Conversation as XMTPConversation, DecodedMessage } from '@xmtp/xmtp-js'
import { ethers } from 'ethers'
import { switchToLinea, validateLineaNetwork, setupNetworkMonitoring } from '../utils/chainValidation'
import { TokenInfo, getAllNFTs, hasMatchingNFTs } from '../utils/tokenUtils'

interface Message {
  senderAddress: string
  content: string
  sent: Date
}

interface Conversation {
  id: string
  peerAddress: string
  messages: Message[]
  groupMetadata?: {
    name: string
    members: string[]
  }
  preview?: string
  lastMessage?: string
  sharedNFTs?: TokenInfo[]
}

type MessageStream = {
  [Symbol.asyncIterator](): AsyncIterator<DecodedMessage>
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
  const streamRef = useRef<MessageStream | null>(null)
  const [userNFTs, setUserNFTs] = useState<TokenInfo[]>([])
  const [availableGroupChats, setAvailableGroupChats] = useState<{
    contractAddress: string
    name: string
    joined: boolean
  }[]>([])
  const initializingRef = useRef(false)

  // Modify the connect function
  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask not found')
      return
    }

    // Prevent multiple simultaneous initialization attempts
    if (initializingRef.current || client) {
      console.log('Already initializing or client exists')
      return
    }

    try {
      initializingRef.current = true
      setIsLoading(true)
      
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.providers.Web3Provider(window.ethereum as any)
      
      try {
        await validateLineaNetwork(provider)
      } catch (error) {
        await switchToLinea()
        const updatedProvider = new ethers.providers.Web3Provider(window.ethereum as any)
        await validateLineaNetwork(updatedProvider)
      }
      
      const signer = provider.getSigner()
      const { Client } = await import('@xmtp/xmtp-js')
      const xmtp = await Client.create(signer, { env: 'production' })
      
      setClient(xmtp)
      setIsConnected(true)
      setError(null)

      // Load existing conversations
      await loadConversations(xmtp)

      // After successful XMTP connection
      const nfts = await getAllNFTs(window.ethereum.selectedAddress)
      setUserNFTs(nfts)
      
      // Update available group chats based on NFTs
      const groups = nfts.map(nft => ({
        contractAddress: nft.contractAddress,
        name: `${nft.name} Holders Chat`,
        joined: false
      }))
      setAvailableGroupChats(groups)
      
    } catch (error: any) {
      console.error('Error connecting to XMTP:', error)
      setError(error.message || 'Failed to connect to XMTP')
      setIsConnected(false)
      setClient(null)
    } finally {
      setIsLoading(false)
      initializingRef.current = false
    }
  }, [client])

  // Then add the effects
  useEffect(() => {
    if (isConnected) {
      setupNetworkMonitoring(async () => {
        setError('Wrong network detected. Switching to Linea...')
        try {
          await switchToLinea()
          // Re-initialize provider after network switch
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

  // Modify the persistence effect
  useEffect(() => {
    const checkPersistedConnection = async () => {
      // Add check for initialization in progress
      if (
        typeof window === 'undefined' || 
        !window.ethereum?.selectedAddress || 
        client || 
        initializingRef.current
      ) return
      
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any)
        await validateLineaNetwork(provider)
        // Only connect if we're not already connecting
        if (!initializingRef.current) {
          await connect()
        }
      } catch (error) {
        console.error('Failed to restore connection:', error)
      }
    }

    checkPersistedConnection()
  }, [client, connect]) // Keep these dependencies

  const disconnect = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current[Symbol.asyncIterator]().return?.()
    }
    
    // Add a delay before disconnecting
    await new Promise(resolve => setTimeout(resolve, 600))
    
    setClient(null)
    setIsConnected(false)
    setMessages([])
    setConversations([])
    setCurrentConversation(null)
    setError(null)
    
    // Add a small delay before removing loading state to allow for transition
    await new Promise(resolve => setTimeout(resolve, 300))
    setIsLoading(false)
  }, [])

  const startChat = useCallback(async (peerAddress: string) => {
    if (!client) {
      setError('Please connect your wallet first')
      return
    }

    try {
      setIsSwitchingChat(true)
      
      // Check if we already have a conversation with this address first
      const existingConversation = conversations.find(conv => 
        !conv.groupMetadata && conv.peerAddress.toLowerCase() === peerAddress.toLowerCase()
      )
      
      if (existingConversation) {
        console.log('Using existing conversation with:', peerAddress)
        const conversation = await client.conversations.newConversation(peerAddress)
        setCurrentConversation(conversation)
        setMessages(existingConversation.messages)
        return
      }

      // Get peer's NFTs only if we don't have an existing conversation
      const peerNFTs = await getAllNFTs(peerAddress)

      // Find shared NFTs
      const shared = userNFTs.filter(userNFT => 
        peerNFTs.some(peerNFT => 
          peerNFT.contractAddress.toLowerCase() === userNFT.contractAddress.toLowerCase() &&
          peerNFT.tokenId === userNFT.tokenId
        )
      )

      if (shared.length === 0) {
        setError('You do not share any NFTs with this address')
        return
      }

      // If we reach here, users share NFTs and can chat
      console.log('Creating new conversation entry for:', peerAddress)
      const newConversation: Conversation = {
        id: `direct:${peerAddress.toLowerCase()}`,
        peerAddress,
        messages: [],
        preview: '',
        lastMessage: '',
        sharedNFTs: shared
      }

      // Get or create the XMTP conversation
      const conversation = await client.conversations.newConversation(peerAddress)
      setCurrentConversation(conversation)
      
      // Add to conversations list
      setConversations(prev => [...prev, newConversation])
      
      // Load existing messages
      const messages = await conversation.messages()
      setMessages(messages.map(msg => ({
        senderAddress: msg.senderAddress,
        content: msg.content as string,
        sent: msg.sent,
      })))

      // Set up stream for new messages - MODIFIED THIS PART
      if (streamRef.current) {
        // Clean up existing stream first
        streamRef.current[Symbol.asyncIterator]().return?.()
      }

      streamRef.current = await conversation.streamMessages()
      
      // Create a separate async function for message handling
      const handleNewMessages = async () => {
        try {
          for await (const msg of streamRef.current!) {
            console.log('New message received:', msg)
            const newMessage = {
              senderAddress: msg.senderAddress,
              content: msg.content as string,
              sent: msg.sent,
            }
            
            // Update both the messages state and the conversation's messages
            setMessages(prevMessages => [...prevMessages, newMessage])
            setConversations(prevConvs => {
              return prevConvs.map(conv => {
                if (conv.peerAddress.toLowerCase() === peerAddress.toLowerCase()) {
                  return {
                    ...conv,
                    messages: [...conv.messages, newMessage],
                    preview: msg.content as string,
                    lastMessage: msg.content as string
                  }
                }
                return conv
              })
            })
          }
        } catch (error) {
          console.error('Error in message stream:', error)
        }
      }

      // Start handling messages
      handleNewMessages()

    } catch (error) {
      console.error('Error starting chat:', error)
      setError('Failed to start chat')
    } finally {
      setIsSwitchingChat(false)
    }
  }, [client, conversations, userNFTs])

  // Modify sendMessage to update local state immediately
  const sendMessage = useCallback(async (message: string) => {
    if (!currentConversation) {
      setError('No active conversation')
      return
    }

    try {
      await currentConversation.send(message)
      
      // Add message to local state immediately
      const newMessage = {
        senderAddress: await client?.address!,
        content: message,
        sent: new Date()
      }
      
      // Update both messages and conversations state
      setMessages(prevMessages => [...prevMessages, newMessage])
      setConversations(prevConvs => {
        return prevConvs.map(conv => {
          if (conv.peerAddress.toLowerCase() === currentConversation.peerAddress.toLowerCase()) {
            return {
              ...conv,
              messages: [...conv.messages, newMessage],
              preview: message,
              lastMessage: message
            }
          }
          return conv
        })
      })
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message')
    }
  }, [currentConversation, client])

  const createGroup = useCallback(async (members: string[], name: string) => {
    if (!client) {
      setError('Please connect your wallet first')
      return
    }

    try {
      const clientAddress = await client.address
      const allMembers = [clientAddress, ...members].sort()
      const groupId = `group:${name}`
      
      // Create conversations with all members
      const groupConversations = await Promise.all(
        members.map(async (member) => {
          return client.conversations.newConversation(member, {
            conversationId: groupId,
            metadata: {
              type: 'group',
              name: name,
              members: JSON.stringify(allMembers)
            }
          })
        })
      )

      const newGroup: Conversation = {
        id: groupId,
        peerAddress: groupConversations[0].peerAddress,
        messages: [],
        groupMetadata: {
          name,
          members: allMembers
        },
        preview: '',
        lastMessage: ''
      }

      setConversations(prev => [...prev, newGroup])
      return groupConversations[0]
    } catch (error) {
      console.error('Error creating group:', error)
      setError('Failed to create group')
    }
  }, [client])

  // Load existing conversations
  const loadConversations = async (xmtp: Client) => {
    try {
      const convos = await xmtp.conversations.list()
      console.log('All XMTP conversations:', convos)
      
      const provider = new ethers.providers.Web3Provider(window.ethereum as any)
      const userAddress = await xmtp.address
      
      // Get user's NFTs
      const myNFTs = await getAllNFTs(userAddress)
      
      // Filter and process conversations
      const conversationsData = await Promise.all(
        convos.map(async (conversation) => {
          const isGroup = conversation.context?.metadata?.type === 'group'
          let peerNFTs: TokenInfo[] = [];  // Declare peerNFTs here
          
          if (isGroup) {
            const groupId = conversation.context?.conversationId
            // Only include if it matches one of our token group IDs
            const isTokenGroup = availableGroupChats.some(g => 
              g.joined && `group:${g.contractAddress}` === groupId
            )
            if (!isTokenGroup) return null
          } else {
            // For direct chats, check if peer has matching NFTs
            peerNFTs = await getAllNFTs(conversation.peerAddress)  // Assign to the declared variable
            
            // Skip if no matching NFTs
            if (!hasMatchingNFTs(myNFTs, peerNFTs)) {
              return null
            }
          }

          const messages = await conversation.messages()
          const conversationId = isGroup 
            ? conversation.context?.conversationId || `group:${conversation.context?.metadata?.name}`
            : `direct:${conversation.peerAddress.toLowerCase()}`
          
          return {
            id: conversationId,
            peerAddress: conversation.peerAddress,
            messages: messages.map(msg => ({
              senderAddress: msg.senderAddress,
              content: msg.content as string,
              sent: msg.sent,
            })),
            groupMetadata: isGroup ? {
              name: conversation.context?.metadata?.name || 'Unnamed Group',
              members: JSON.parse(conversation.context?.metadata?.members || '[]')
            } : undefined,
            preview: messages[messages.length - 1]?.content as string || '',
            lastMessage: messages[messages.length - 1]?.content as string || '',
            sharedNFTs: !isGroup ? peerNFTs.filter((peerNFT: TokenInfo) => 
              myNFTs.some((myNFT: TokenInfo) => 
                myNFT.contractAddress.toLowerCase() === peerNFT.contractAddress.toLowerCase() &&
                myNFT.tokenId === peerNFT.tokenId
              )
            ) : undefined
          }
        })
      )

      // Filter out null values and sort conversations by most recent message
      const validConversations = conversationsData.filter(conv => conv !== null)
      const sortedConversations = validConversations.sort((a, b) => {
        const aTime = a.messages[a.messages.length - 1]?.sent.getTime() || 0
        const bTime = b.messages[b.messages.length - 1]?.sent.getTime() || 0
        return bTime - aTime
      })
      
      console.log('Final filtered conversations:', sortedConversations)
      setConversations(sortedConversations)
    } catch (error) {
      console.error('Error loading conversations:', error)
      setError('Failed to load conversations')
    }
  }

  // Add function to join/leave group chats
  const toggleGroupChat = useCallback(async (contractAddress: string) => {
    const group = availableGroupChats.find(g => g.contractAddress === contractAddress)
    if (!group) return

    if (group.joined) {
      // Leave group logic
      setAvailableGroupChats(prev => 
        prev.map(g => g.contractAddress === contractAddress ? {...g, joined: false} : g)
      )
    } else {
      // Join group logic
      setAvailableGroupChats(prev => 
        prev.map(g => g.contractAddress === contractAddress ? {...g, joined: true} : g)
      )
    }
  }, [availableGroupChats])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current[Symbol.asyncIterator]().return?.()
      }
    }
  }, [])

  // Modify the ownership check effect to run less frequently
  useEffect(() => {
    if (!isConnected || !client) return

    const checkNFTOwnership = async () => {
      const userAddress = await client.address
      const currentNFTs = await getAllNFTs(userAddress)
      setUserNFTs(currentNFTs)

      // Only check conversations that exist
      if (conversations.length > 0) {
        const filteredConversations = await Promise.all(
          conversations.map(async (conv) => {
            if (conv.groupMetadata) {
              // Group chat logic...
              return conv // For now, keep group chats
            } else {
              const peerNFTs = await getAllNFTs(conv.peerAddress)
              return hasMatchingNFTs(currentNFTs, peerNFTs) ? conv : null
            }
          })
        )
        setConversations(filteredConversations.filter(conv => conv !== null))
      }
    }

    // Run ownership check less frequently (every 5 minutes)
    const interval = setInterval(checkNFTOwnership, 5 * 60 * 1000)

    // Run once on initial connection
    if (userNFTs.length === 0) {
      checkNFTOwnership()
    }

    return () => clearInterval(interval)
  }, [isConnected, client])

  return {
    connect,
    disconnect,
    sendMessage,
    startChat,
    createGroup,
    messages,
    conversations,
    setConversations,
    isConnected,
    error,
    isLoading,
    setIsLoading,
    isSwitchingChat,
    userNFTs,
    availableGroupChats,
    toggleGroupChat,
  }
} 