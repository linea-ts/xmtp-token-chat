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
    type?: 'token_group' | 'group'
  }
  preview?: string
  lastMessage?: string
  sharedNFTs?: TokenInfo[]
}

type MessageStream = {
  [Symbol.asyncIterator](): AsyncIterator<DecodedMessage>
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

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
  const [wasDisconnected, setWasDisconnected] = useState(false)
  const [tokenGroups, setTokenGroups] = useState<{
    [contractAddress: string]: {
      name: string
      members: string[]
    }
  }>({})

  const disconnect = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current[Symbol.asyncIterator]().return?.()
    }
    
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
        !window.ethereum.selectedAddress || 
        client || 
        initializingRef.current ||
        wasExplicitlyDisconnected ||
        wasDisconnected
      ) return
      
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

  const handleNewStreamMessage = useCallback((msg: DecodedMessage, peerAddress: string) => {
    console.log('New message received:', msg)
    const newMessage = {
      senderAddress: msg.senderAddress,
      content: msg.content as string,
      sent: msg.sent,
    }
    
    setMessages(prevMessages => {
      // Check if message already exists with 1 second tolerance
      const messageExists = prevMessages.some(m => 
        m.senderAddress === newMessage.senderAddress && 
        m.content === newMessage.content &&
        Math.abs(m.sent.getTime() - newMessage.sent.getTime()) < 1000
      )
      if (messageExists) return prevMessages
      return [...prevMessages, newMessage]
    })

    setConversations(prevConvs => {
      return prevConvs.map(conv => {
        if (conv.peerAddress.toLowerCase() === peerAddress.toLowerCase()) {
          // Check if message already exists in conversation
          const messageExists = conv.messages.some(m => 
            m.senderAddress === newMessage.senderAddress && 
            m.content === newMessage.content &&
            Math.abs(m.sent.getTime() - newMessage.sent.getTime()) < 1000
          )
          if (messageExists) return conv
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
  }, [])

  const startChat = useCallback(async (peerAddress: string) => {
    if (!client) {
      setError('Please connect your wallet first')
      return
    }

    try {
      setIsSwitchingChat(true)
      
      const conversation = await client.conversations.newConversation(peerAddress)
      const uniqueId = `direct:${peerAddress.toLowerCase()}:${conversation.topic}`
      
      const existingConversation = conversations.find(conv => 
        !conv.groupMetadata && conv.id === uniqueId
      )
      
      if (existingConversation) {
        console.log('Using existing conversation with:', peerAddress)
        setCurrentConversation(conversation)
        setMessages(existingConversation.messages)
        
        // Set up message streaming for existing conversation
        if (streamRef.current) {
          streamRef.current[Symbol.asyncIterator]().return?.()
        }
        streamRef.current = await conversation.streamMessages()
        
        const handleNewMessages = async () => {
          try {
            for await (const msg of streamRef.current!) {
              handleNewStreamMessage(msg, peerAddress)
            }
          } catch (error) {
            console.error('Error in message stream:', error)
          }
        }

        handleNewMessages()
        return
      }

      console.log('Creating new conversation entry for:', peerAddress)
      const newConversation: Conversation = {
        id: uniqueId,
        peerAddress,
        messages: [],
        preview: '',
        lastMessage: ''
      }

      setCurrentConversation(conversation)
      setConversations(prev => [...prev, newConversation])
      
      // Fetch initial messages
      const initialMessages = await conversation.messages()
      const formattedMessages = initialMessages.map(msg => ({
        senderAddress: msg.senderAddress,
        content: msg.content as string,
        sent: msg.sent,
      }))
      
      setMessages(formattedMessages)
      setConversations(prev => prev.map(conv => 
        conv.id === uniqueId 
          ? { ...conv, messages: formattedMessages }
          : conv
      ))
      
      // Set up message streaming for new conversation
      if (streamRef.current) {
        streamRef.current[Symbol.asyncIterator]().return?.()
      }
      streamRef.current = await conversation.streamMessages()
      
      const handleNewMessages = async () => {
        try {
          for await (const msg of streamRef.current!) {
            handleNewStreamMessage(msg, peerAddress)
          }
        } catch (error) {
          console.error('Error in message stream:', error)
        }
      }

      handleNewMessages()

    } catch (error) {
      console.error('Error starting chat:', error)
      setError('Failed to start chat')
    } finally {
      setIsSwitchingChat(false)
    }
  }, [client, conversations, handleNewStreamMessage])

  const sendMessage = useCallback(async (message: string) => {
    if (!currentConversation) {
      setError('No active conversation')
      return
    }

    try {
      const sentMessage = await currentConversation.send(message)
      
      const newMessage = {
        senderAddress: await client?.address!,
        content: message,
        sent: sentMessage.sent // Use the sent timestamp from XMTP
      }
      
      // Add message to UI immediately
      setMessages(prevMessages => {
        // Check if message already exists
        const messageExists = prevMessages.some(m => 
          m.senderAddress === newMessage.senderAddress && 
          m.content === newMessage.content &&
          Math.abs(m.sent.getTime() - newMessage.sent.getTime()) < 1000 // Allow 1 second difference
        )
        if (messageExists) return prevMessages
        return [...prevMessages, newMessage]
      })

      setConversations(prevConvs => {
        return prevConvs.map(conv => {
          if (conv.peerAddress.toLowerCase() === currentConversation.peerAddress.toLowerCase()) {
            // Check if message already exists in conversation
            const messageExists = conv.messages.some(m => 
              m.senderAddress === newMessage.senderAddress && 
              m.content === newMessage.content &&
              Math.abs(m.sent.getTime() - newMessage.sent.getTime()) < 1000
            )
            if (messageExists) return conv
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
        lastMessage: ''
      }

      // Set up message streaming for the group
      if (streamRef.current) {
        streamRef.current[Symbol.asyncIterator]().return?.()
      }

      streamRef.current = await group.streamMessages()
      
      const handleNewMessages = async () => {
        try {
          for await (const msg of streamRef.current!) {
            const newMessage = {
              senderAddress: msg.senderAddress,
              content: msg.content as string,
              sent: msg.sent,
            }
            
            setMessages(prevMessages => [...prevMessages, newMessage])
            setConversations(prevConvs => {
              return prevConvs.map(conv => {
                if (conv.id === groupId) {
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
          console.error('Error in group message stream:', error)
        }
      }

      handleNewMessages()

      setConversations(prev => [...prev, newGroup])
      return group
    } catch (error) {
      console.error('Error joining token group:', error)
      setError('Failed to join token group')
    }
  }, [client, userNFTs])

  const loadConversations = async (xmtp: Client) => {
    try {
      const convos = await xmtp.conversations.list()
      console.log('Raw conversations:', convos)
      
      const conversationsData = await Promise.all(
        convos.map(async (conversation): Promise<ConversationData | null> => {
          const isGroup = conversation.context?.conversationId?.startsWith('group:')
          
          // For 1-on-1 chats, just return the conversation without NFT filtering
          if (!isGroup) {
            const messages = await conversation.messages()
            // Include conversation topic in the ID to ensure uniqueness
            const uniqueId = `direct:${conversation.peerAddress.toLowerCase()}:${conversation.context?.conversationId || conversation.topic}`
            return {
              id: uniqueId,
              peerAddress: conversation.peerAddress,
              messages: messages.map(msg => ({
                senderAddress: msg.senderAddress,
                content: msg.content as string,
                sent: msg.sent,
              })),
              preview: messages[messages.length - 1]?.content as string || '',
              lastMessage: messages[messages.length - 1]?.content as string || ''
            }
          }

          // Keep existing group chat logic
          if (isGroup) {
            const groupId = conversation.context?.conversationId
            const isTokenGroup = availableGroupChats.some(g => 
              g.joined && `group:${g.contractAddress}` === groupId
            )
            if (!isTokenGroup) return null

            const messages = await conversation.messages()
            return {
              id: groupId || `group:${conversation.context?.metadata?.name}`,
              peerAddress: conversation.peerAddress,
              messages: messages.map(msg => ({
                senderAddress: msg.senderAddress,
                content: msg.content as string,
                sent: msg.sent,
              })),
              groupMetadata: {
                name: conversation.context?.metadata?.name || 'Unnamed Group',
                members: JSON.parse(conversation.context?.metadata?.members || '[]')
              },
              preview: messages[messages.length - 1]?.content as string || '',
              lastMessage: messages[messages.length - 1]?.content as string || ''
            }
          }
          
          return null
        })
      )

      const validConversations = conversationsData.filter((conv): conv is ConversationData => conv !== null)
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

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current[Symbol.asyncIterator]().return?.()
      }
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

  return {
    connect,
    disconnect,
    sendMessage,
    startChat,
    joinTokenGroup,
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
  } as const
} 