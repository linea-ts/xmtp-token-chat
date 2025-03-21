'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Client, Conversation as XMTPConversation, DecodedMessage } from '@xmtp/xmtp-js'
import { ethers } from 'ethers'

interface Message {
  senderAddress: string
  content: string
  sent: Date
}

interface GroupMetadata {
  name: string
  members: string[]
}

interface Conversation {
  peerAddress: string
  messages: Message[]
  isGroup?: boolean
  groupMetadata?: GroupMetadata
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
  const streamRef = useRef<MessageStream | null>(null)

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return

    if (!window.ethereum) {
      setError('MetaMask not found')
      return
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      
      const { Client } = await import('@xmtp/xmtp-js')
      const xmtp = await Client.create(signer, { env: 'production' })
      setClient(xmtp)
      setIsConnected(true)
      setError(null)

      // Load existing conversations
      const convos = await xmtp.conversations.list()
      const conversationsData = await Promise.all(
        convos.map(async (conversation) => {
          const messages = await conversation.messages()
          const metadata = conversation.context?.metadata
          const isGroup = metadata?.type === 'group'
          
          return {
            peerAddress: conversation.peerAddress,
            messages: messages.map((msg) => ({
              senderAddress: msg.senderAddress,
              content: msg.content as string,
              sent: msg.sent,
            })),
            isGroup,
            groupMetadata: isGroup ? {
              name: metadata.name,
              // Parse the members string back into an array
              members: metadata.members ? JSON.parse(metadata.members) : []
            } : undefined
          }
        })
      )

      setConversations(conversationsData)
    } catch (error) {
      console.error('Error connecting to XMTP:', error)
      setError('Failed to connect to XMTP')
      setIsConnected(false)
      setClient(null)
    }
  }, [])

  const disconnect = useCallback(() => {
    if (streamRef.current) {
      streamRef.current[Symbol.asyncIterator]().return?.()
    }
    setClient(null)
    setIsConnected(false)
    setMessages([])
    setConversations([])
    setCurrentConversation(null)
    setError(null)
  }, [])

  const startChat = useCallback(async (address: string) => {
    if (!client) {
      setError('Please connect your wallet first')
      return
    }

    try {
      if (!ethers.utils.isAddress(address)) {
        setError('Invalid Ethereum address')
        return
      }

      const canMessage = await client.canMessage(address)
      if (!canMessage) {
        setError('This address has not yet initialized their XMTP identity')
        return
      }

      // Clean up existing stream if any
      if (streamRef.current) {
        streamRef.current[Symbol.asyncIterator]().return?.()
      }

      const conversation = await client.conversations.newConversation(address)
      setCurrentConversation(conversation)

      // Load existing messages
      const msgs = await conversation.messages()
      setMessages(
        msgs.map((msg) => ({
          senderAddress: msg.senderAddress,
          content: msg.content as string,
          sent: msg.sent,
        }))
      )

      // Stream new messages
      streamRef.current = await conversation.streamMessages()
      for await (const msg of streamRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            senderAddress: msg.senderAddress,
            content: msg.content as string,
            sent: msg.sent,
          },
        ])
      }
    } catch (error) {
      console.error('Error starting chat:', error)
      setError('Failed to start chat')
    }
  }, [client])

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
      const groupId = `group:${name}:${Date.now()}`
      const allMembers = [clientAddress, ...members]
      const membersString = JSON.stringify(allMembers)
      
      // Create conversations with all members
      const conversations = await Promise.all(
        members.map(async (member) => {
          return client.conversations.newConversation(member, {
            conversationId: groupId,
            metadata: {
              type: 'group',
              name: name,
              members: membersString
            }
          })
        })
      )

      const newGroup: Conversation = {
        peerAddress: conversations[0].peerAddress,
        messages: [],
        isGroup: true,
        groupMetadata: {
          name,
          members: allMembers
        }
      }

      setConversations(prev => [...prev, newGroup])
      return conversations[0]
    } catch (error) {
      console.error('Error creating group:', error)
      setError('Failed to create group')
    }
  }, [client])

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
  }
} 