'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Client, Conversation as XMTPConversation, DecodedMessage } from '@xmtp/xmtp-js'
import { ethers } from 'ethers'

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

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return

    if (!window.ethereum) {
      setError('MetaMask not found')
      return
    }

    try {
      setIsLoading(true)
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      
      const { Client } = await import('@xmtp/xmtp-js')
      const xmtp = await Client.create(signer, { env: 'production' })
      
      setClient(xmtp)
      setIsConnected(true)
      setError(null)

      // Load existing conversations
      await loadConversations(xmtp)
    } catch (error) {
      console.error('Error connecting to XMTP:', error)
      setError('Failed to connect to XMTP')
      setIsConnected(false)
      setClient(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

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
      console.log('Starting chat with address:', peerAddress)
      console.log('Current conversations:', conversations)
      
      // Clean up existing message stream
      if (streamRef.current) {
        console.log('Cleaning up existing message stream')
        streamRef.current[Symbol.asyncIterator]().return?.()
      }

      // Check if we already have a conversation with this address
      const existingConversation = conversations.find(conv => 
        !conv.groupMetadata && conv.peerAddress.toLowerCase() === peerAddress.toLowerCase()
      )
      
      console.log('Found existing conversation:', existingConversation)

      // If starting a chat from the input, add it to conversations list if not exists
      if (!existingConversation) {
        console.log('Creating new conversation entry for:', peerAddress)
        const newConversation: Conversation = {
          id: `direct:${peerAddress.toLowerCase()}`,
          peerAddress,
          messages: [],
          preview: '',
          lastMessage: ''
        }
        setConversations(prev => [...prev, newConversation])
      } else {
        console.log('Using existing conversation with:', peerAddress)
      }

      // Get or create the XMTP conversation
      console.log('Getting XMTP conversation for:', peerAddress)
      const conversation = await client.conversations.newConversation(peerAddress)
      setCurrentConversation(conversation)
      
      // Load existing messages
      console.log('Loading messages for conversation')
      const messages = await conversation.messages()
      console.log('Found existing messages:', messages.length)
      setMessages(messages.map(msg => ({
        senderAddress: msg.senderAddress,
        content: msg.content as string,
        sent: msg.sent,
      })))

      // Set up stream for new messages
      console.log('Setting up message stream')
      streamRef.current = await conversation.streamMessages()
      ;(async () => {
        for await (const msg of streamRef.current!) {
          console.log('Received new message:', {
            from: msg.senderAddress,
            content: msg.content,
            time: msg.sent
          })
          setMessages(prevMessages => [...prevMessages, {
            senderAddress: msg.senderAddress,
            content: msg.content as string,
            sent: msg.sent,
          }])
        }
      })()
    } catch (error) {
      console.error('Error starting chat:', error)
      setError('Failed to start chat')
    } finally {
      setIsSwitchingChat(false)
    }
  }, [client, conversations])

  const sendMessage = useCallback(async (message: string) => {
    if (!currentConversation) {
      setError('No active conversation')
      return
    }

    try {
      await currentConversation.send(message)
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message')
    }
  }, [currentConversation])

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
      
      const conversationsData = await Promise.all(
        convos.map(async (conversation) => {
          const messages = await conversation.messages()
          const isGroup = conversation.context?.metadata?.type === 'group'
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
            lastMessage: messages[messages.length - 1]?.content as string || ''
          }
        })
      )

      // Sort conversations by most recent message
      const sortedConversations = conversationsData.sort((a, b) => {
        const aTime = a.messages[a.messages.length - 1]?.sent.getTime() || 0
        const bTime = b.messages[b.messages.length - 1]?.sent.getTime() || 0
        return bTime - aTime
      })
      
      console.log('Final conversations:', sortedConversations)
      setConversations(sortedConversations)
    } catch (error) {
      console.error('Error loading conversations:', error)
      setError('Failed to load conversations')
    }
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current[Symbol.asyncIterator]().return?.()
      }
    }
  }, [])

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
  }
} 