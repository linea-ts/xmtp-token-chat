'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Client, Conversation as XMTPConversation, DecodedMessage } from '@xmtp/xmtp-js'
import { ethers } from 'ethers'

interface Message {
  senderAddress: string
  content: string
  sent: Date
}

interface Conversation {
  peerAddress: string
  messages: Message[]
}

export function useXmtp() {
  const [client, setClient] = useState<Client | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<XMTPConversation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<AsyncIterator<DecodedMessage> | null>(null)

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask not found')
      return
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      const xmtp = await Client.create(signer, { env: 'production' })
      setClient(xmtp)
      setIsConnected(true)
      setError(null)

      // Load existing conversations
      const convos = await xmtp.conversations.list()
      const conversationsData = await Promise.all(
        convos.map(async (conversation) => {
          const messages = await conversation.messages()
          return {
            peerAddress: conversation.peerAddress,
            messages: messages.map((msg) => ({
              senderAddress: msg.senderAddress,
              content: msg.content as string,
              sent: msg.sent,
            })),
          }
        })
      )
      setConversations(conversationsData)
    } catch (error) {
      console.error('Error connecting to XMTP:', error)
      setError('Failed to connect to XMTP')
    }
  }, [])

  const disconnect = useCallback(() => {
    setClient(null)
    setIsConnected(false)
    setMessages([])
    setConversations([])
    setCurrentConversation(null)
    setError(null)
  }, [])

  const canMessage = useCallback(async (address: string): Promise<boolean> => {
    if (!client) return false
    try {
      return await client.canMessage(address)
    } catch (error) {
      console.error('Error checking if can message:', error)
      return false
    }
  }, [client])

  const startChat = useCallback(async (address: string) => {
    if (!client) {
      setError('Please connect your wallet first')
      return
    }

    try {
      // Check if the address is valid
      if (!ethers.utils.isAddress(address)) {
        setError('Invalid Ethereum address')
        return
      }

      // Check if the recipient is on the XMTP network
      const canMessageRecipient = await canMessage(address)
      if (!canMessageRecipient) {
        setError('This address has not yet used XMTP. They need to initialize their XMTP identity first.')
        return
      }

      const conversation = await client.conversations.newConversation(address)
      setCurrentConversation(conversation)
      setError(null)

      // Load existing messages
      const existingMessages = await conversation.messages()
      setMessages(
        existingMessages.map((msg) => ({
          senderAddress: msg.senderAddress,
          content: msg.content as string,
          sent: msg.sent,
        }))
      )

      // Set up message stream
      streamRef.current = await conversation.streamMessages()
    } catch (error) {
      console.error('Error starting chat:', error)
      setError('Failed to start chat')
    }
  }, [client, canMessage])

  // Handle message streaming
  useEffect(() => {
    let isMounted = true

    const processStream = async () => {
      if (!streamRef.current) return

      try {
        for await (const msg of streamRef.current) {
          if (!isMounted) break
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
        console.error('Error processing message stream:', error)
      }
    }

    processStream()

    return () => {
      isMounted = false
      streamRef.current = null
    }
  }, [currentConversation])

  const sendMessage = useCallback(async (content: string) => {
    if (!currentConversation || !content.trim()) return

    try {
      await currentConversation.send(content)
      setMessages((prev) => [
        ...prev,
        {
          senderAddress: client?.address || '',
          content,
          sent: new Date(),
        },
      ])
      setError(null)
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message')
    }
  }, [currentConversation, client])

  return {
    client,
    isConnected,
    connect,
    disconnect,
    sendMessage,
    messages,
    startChat,
    conversations,
    error,
  }
} 