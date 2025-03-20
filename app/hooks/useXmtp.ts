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
  peerAddress: string
  messages: Message[]
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
      
      // Dynamically import XMTP client
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
    messages,
    conversations,
    isConnected,
    error,
  }
} 