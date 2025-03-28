'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Client, Conversation as XMTPConversation, DecodedMessage, Stream } from '@xmtp/xmtp-js'
import { ethers } from 'ethers'
import { switchToLinea, validateLineaNetwork, setupNetworkMonitoring } from '../utils/chainValidation'
import { TokenInfo, getAllNFTs, hasMatchingNFTs, getSharedNFTs } from '../utils/tokenUtils'
import { Message, Conversation } from '../types/chat'
import { addDeletedChat, isConversationDeleted, removeFromDeletedChats } from '../utils/deletedChats'

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
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const nftCacheRef = useRef<{
    [address: string]: {
      nfts: TokenInfo[];
      timestamp: number;
    };
  }>({})

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
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      if (!window.ethereum) {
        setError('Please install MetaMask to use this app')
        return
      }

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
      
      // Add check for new window/tab
      const isNewSession = !localStorage.getItem('xmtp-session')
      
      if (
        typeof window === 'undefined' || 
        !window.ethereum || 
        client || 
        initializingRef.current ||
        wasExplicitlyDisconnected ||
        wasDisconnected ||
        isNewSession  // Add this condition
      ) return
      
      // Only attempt auto-connect if we already have a connected account
      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (!accounts || accounts.length === 0) return
      
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum)
        await validateLineaNetwork(provider)
        if (!initializingRef.current) {
          // Set session flag before connecting
          localStorage.setItem('xmtp-session', 'true')
          await connect()
        }
      } catch (error) {
        console.error('Failed to restore connection:', error)
      }
    }

    checkPersistedConnection()
  }, [client, connect, wasDisconnected])

  // Add cleanup for session flag when component unmounts
  useEffect(() => {
    return () => {
      localStorage.removeItem('xmtp-session')
    }
  }, [])

  const markConversationAsRead = useCallback((conversationId: string) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unreadCount: 0 }
          : conv
      )
    )
  }, [])

  const getConversationId = (peerAddress: string, topic: string, isGroup = false) => {
    return isGroup ? `group:${peerAddress}` : `direct:${peerAddress.toLowerCase()}:${topic}`;
  };

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
    if (!client) return;

    try {
        const userAddress = await client.address;
        const userNFTs = await getCachedNFTs(userAddress);
        const peerNFTs = await getCachedNFTs(peerAddress);
        const sharedNFTs = getSharedNFTs(userNFTs, peerNFTs);

        if (sharedNFTs.length === 0) {
            console.log('Message dropped - no shared NFTs between', {
                userAddress,
                peerAddress,
                userNFTCount: userNFTs.length,
                peerNFTCount: peerNFTs.length
            });
            return;
        }

        // If the conversation was deleted, restore it
        if (isConversationDeleted(peerAddress)) {
            removeFromDeletedChats(peerAddress);
        }

        // Set up stream for this conversation if it doesn't exist
        if (!streamsRef.current.has(peerAddress)) {
            const conversation = await client.conversations.newConversation(peerAddress);
            await setupStreamForConversation(conversation);
        }

        const newMessage = {
            senderAddress: msg.senderAddress,
            content: msg.content as string,
            sent: msg.sent,
        };
        
        const isFromMe = msg.senderAddress.toLowerCase() === client?.address?.toLowerCase();
        
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
            const existingConvIndex = prevConvs.findIndex(
                conv => conv.peerAddress.toLowerCase() === peerAddress.toLowerCase()
            );

            if (existingConvIndex !== -1) {
                // Update existing conversation
                const updatedConvs = [...prevConvs];
                const conv = updatedConvs[existingConvIndex];
                
                const messageExists = conv.messages.some(m => 
                    m.senderAddress === newMessage.senderAddress && 
                    m.content === newMessage.content &&
                    Math.abs(m.sent.getTime() - newMessage.sent.getTime()) < 5000
                );
                
                if (!messageExists) {
                    const shouldIncrementUnread = !isFromMe && 
                        currentConversation?.peerAddress.toLowerCase() !== peerAddress.toLowerCase();

                    updatedConvs[existingConvIndex] = {
                        ...conv,
                        messages: [...conv.messages, newMessage],
                        preview: msg.content as string,
                        lastMessage: msg.content as string,
                        lastMessageTimestamp: msg.sent.getTime(),
                        unreadCount: shouldIncrementUnread ? (conv.unreadCount || 0) + 1 : conv.unreadCount || 0
                    };
                }
                return updatedConvs.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
            } else {
                // Create new conversation
                const newConv: Conversation = {
                    id: getConversationId(peerAddress, msg.conversation?.topic || ''),
                    peerAddress: peerAddress.toLowerCase(),
                    messages: [newMessage],
                    preview: msg.content as string,
                    lastMessage: msg.content as string,
                    lastMessageTimestamp: msg.sent.getTime(),
                    unreadCount: isFromMe ? 0 : 1,
                    sharedNFTs
                };
                return [...prevConvs, newConv].sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
            }
        });
    } catch (error) {
        console.error('Error processing new message:', error);
    }
}, [client?.address, currentConversation, getCachedNFTs]);

  const startChat = useCallback(async (addressInput: string) => {
    if (!client) return null
    
    try {
      const peerAddress = ethers.utils.getAddress(addressInput).toLowerCase()
      
      // Don't allow starting chat with deleted conversation unless explicitly restored
      if (isConversationDeleted(peerAddress)) {
        removeFromDeletedChats(peerAddress); // Explicitly restore the conversation
      }

      const userAddress = await client.address
      
      if (peerAddress === userAddress.toLowerCase()) {
        throw new Error("You cannot send messages to yourself")
      }

      // Enhanced NFT validation with more specific errors
      let sharedNFTs: TokenInfo[] = [] // Define sharedNFTs here
      try {
        const userNFTs = await getCachedNFTs(userAddress)
        const peerNFTs = await getCachedNFTs(peerAddress)
        sharedNFTs = getSharedNFTs(userNFTs, peerNFTs) // Assign the result to sharedNFTs

        if (sharedNFTs.length === 0) {
          if (userNFTs.length === 0) {
            throw new Error("You don't own any NFTs")
          }
          if (peerNFTs.length === 0) {
            throw new Error("The recipient doesn't own any NFTs on Linea")
          }
          throw new Error("You don't share any NFTs with this address")
        }
      } catch (nftError: any) {
        console.error('NFT validation error:', nftError)
        throw new Error(nftError.message || "Failed to validate NFTs")
      }

      const conversation = await client.conversations.newConversation(peerAddress)
      const uniqueId = getConversationId(peerAddress, conversation.topic)
      
      const existingConversation = conversations.find(conv => 
        !conv.groupMetadata && conv.id === uniqueId
      )
      
      if (existingConversation) {
        console.log('Using existing conversation with:', peerAddress)
        setCurrentConversation(conversation)
        await setupStreamForConversation(conversation)
        return existingConversation.messages
      }

      console.log('Creating new conversation entry for:', peerAddress)
      const newConversation: Conversation = {
        id: uniqueId,
        peerAddress,
        messages: [],
        preview: '',
        lastMessage: '',
        unreadCount: 0,
        lastMessageTimestamp: Date.now(),
        sharedNFTs,
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
      
      setConversations(prev => prev.map(conv => 
        conv.id === uniqueId 
          ? { ...conv, messages: formattedMessages }
          : conv
      ))
      
      // Set up stream for new conversation
      await setupStreamForConversation(conversation)
      return formattedMessages

    } catch (error: any) {
      console.error('Error starting chat:', error)
      throw error
    }
  }, [client, conversations, handleNewStreamMessage])

  const sendMessage = useCallback(async (message: string) => {
    if (!currentConversation) {
      throw new Error('No active conversation')
    }

    try {
      // Validate NFTs before sending
      const userAddress = await client?.address!
      const peerAddress = currentConversation.peerAddress
      const userNFTs = await getCachedNFTs(userAddress)
      const peerNFTs = await getCachedNFTs(peerAddress)
      const sharedNFTs = getSharedNFTs(userNFTs, peerNFTs)

      if (sharedNFTs.length === 0) {
        throw new Error("Message cannot be sent - you no longer share any tokens with this address")
      }

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
              lastMessage: message,
              lastMessageTimestamp: Date.now(),
              unreadCount: 0
            }
          }
          return conv
        })
      })
    } catch (error: any) {
      console.error('Error sending message:', error)
      throw error
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
            description: `Group chat for owners of tokens from contract ${contractAddress}`,
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
        sharedNFTs: [],
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
      
      // Set up streams first, before processing conversations
      await Promise.all(allConversations.map(async (conversation) => {
        try {
          await setupStreamForConversation(conversation)
        } catch (error) {
          console.error('Error setting up stream for conversation:', error)
        }
      }))

      // Process conversations for UI
      const validConversations: ConversationData[] = []
      const BATCH_SIZE = 5;

      for (let i = 0; i < allConversations.length; i += BATCH_SIZE) {
        const batch = allConversations.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(async (conversation): Promise<ConversationData | null> => {
            const isGroup = conversation.context?.conversationId?.startsWith('group:')
            const peerAddress = conversation.peerAddress.toLowerCase()
            const groupName = isGroup ? conversation.context?.metadata?.name : undefined
            
            if (isConversationDeleted(peerAddress, groupName)) {
              return null;
            }
            
            if (!isGroup) {
              if (peerAddress === userAddress.toLowerCase()) return null;

              const peerNFTs = await getCachedNFTs(peerAddress)
              const sharedNFTs = getSharedNFTs(userNFTs, peerNFTs)
              
              if (sharedNFTs.length === 0) return null;

              const messages = await conversation.messages()
              const uniqueId = getConversationId(peerAddress, conversation.topic)
              
              return {
                id: uniqueId,
                peerAddress,
                messages: messages.map(msg => ({
                  senderAddress: msg.senderAddress,
                  content: msg.content as string,
                  sent: msg.sent,
                })),
                preview: messages[messages.length - 1]?.content as string || '',
                lastMessage: messages[messages.length - 1]?.content as string || '',
                unreadCount: 0,
                lastMessageTimestamp: messages[messages.length - 1]?.sent.getTime() || Date.now(),
                sharedNFTs,
              }
            }

            if (isGroup) {
              const groupId = conversation.context?.conversationId
              const isTokenGroup = availableGroupChats.some(g => 
                g.joined && `group:${g.contractAddress}` === groupId
              )
              if (!isTokenGroup) return null;

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
                lastMessage: messages[messages.length - 1]?.content as string || '',
                unreadCount: 0,
                lastMessageTimestamp: messages[messages.length - 1]?.sent.getTime() || Date.now(),
                sharedNFTs: [],
              }
            }
            
            return null
          })
        )

        validConversations.push(...batchResults.filter(Boolean) as ConversationData[])
      }

      // Remove duplicates and sort
      const uniqueConversations = validConversations.reduce((acc, current) => {
        const exists = acc.find(conv => 
          conv.peerAddress.toLowerCase() === current.peerAddress.toLowerCase()
        )
        if (!exists) {
          acc.push(current)
        }
        return acc
      }, [] as ConversationData[])

      const sortedConversations = uniqueConversations.sort((a, b) => 
        (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0)
      )
      
      setConversations(sortedConversations)

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
      const currentNFTs = await getCachedNFTs(userAddress)
      
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

  const setupStreamForConversation = useCallback(async (conversation: XMTPConversation) => {
    const streamKey = conversation.peerAddress.toLowerCase();
    
    // Don't set up duplicate streams
    if (streamsRef.current.has(streamKey)) {
        return;
    }

    try {
        const stream = await conversation.streamMessages();
        streamsRef.current.set(streamKey, stream);

        const processStream = async () => {
            try {
                for await (const msg of stream) {
                    await handleNewStreamMessage(msg, conversation.peerAddress);
                }
            } catch (error) {
                console.error('Error in message stream:', error);
                // Remove failed stream so it can be recreated
                streamsRef.current.delete(streamKey);
            }
        };

        processStream();
    } catch (error) {
        console.error('Error setting up message stream:', error);
        streamsRef.current.delete(streamKey);
    }
}, [handleNewStreamMessage]);

  const setupConversationStream = async (xmtp: Client) => {
    try {
        const stream = await xmtp.conversations.stream();
        conversationStreamRef.current = stream;

        const handleNewConversations = async () => {
            try {
                for await (const conversation of stream) {
                    const streamKey = conversation.peerAddress.toLowerCase();
                    if (!streamsRef.current.has(streamKey)) {
                        await setupStreamForConversation(conversation);
                    }
                }
            } catch (error) {
                console.error('Error in conversation stream:', error);
            }
        };

        handleNewConversations();
    } catch (error) {
        console.error('Error setting up conversation stream:', error);
    }
};

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
      const currentNFTs = await getCachedNFTs(userAddress)
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

  const selectConversation = useCallback(async (conversationId: string) => {
    if (!client) return

    try {
      const conversation = conversations.find(c => c.id === conversationId)
      if (!conversation) {
        throw new Error('Conversation not found')
      }

      const xmtpConversation = await client.conversations.newConversation(
        conversation.peerAddress
      )
      setCurrentConversation(xmtpConversation)
      
      return conversation
    } catch (error) {
      console.error('Error selecting conversation:', error)
      setError('Failed to select conversation')
      return null
    }
  }, [client, conversations])

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

  const deleteConversation = useCallback((peerAddress: string, groupName?: string) => {
    // Add to deleted chats
    addDeletedChat(peerAddress, groupName);
    
    // Remove from current conversations
    setConversations(prev => 
      prev.filter(conv => 
        !(conv.peerAddress.toLowerCase() === peerAddress.toLowerCase() && 
          conv.groupMetadata?.name === groupName)
      )
    );

    // Clear current conversation if it was the deleted one
    if (currentConversation?.peerAddress.toLowerCase() === peerAddress.toLowerCase()) {
      setCurrentConversation(null);
    }

    // Clean up the message stream for this conversation
    const streamKey = `${peerAddress}${groupName || ''}`;
    if (streamsRef.current.has(streamKey)) {
      streamsRef.current.get(streamKey)?.[Symbol.asyncIterator]().return?.();
      streamsRef.current.delete(streamKey);
    }
  }, []);

  const handleNewConversations = useCallback(async () => {
    if (!client) return;
    
    try {
      setIsLoadingConversations(true);
      const convos = await client.conversations.list();
      const processedConvos: Conversation[] = [];

      for (const conversation of convos) {
        const peerAddress = conversation.peerAddress.toLowerCase();
        
        // Skip if conversation is deleted
        if (isConversationDeleted(peerAddress)) {
          continue;
        }

        const messages = await conversation.messages();
        const userAddress = await client.address;
        const userNFTs = await getCachedNFTs(userAddress);
        const peerNFTs = await getCachedNFTs(peerAddress);
        const sharedNFTs = getSharedNFTs(userNFTs, peerNFTs);

        const processedMessages = messages.map(msg => ({
          content: msg.content,
          senderAddress: msg.senderAddress,
          sent: msg.sent
        }));

        // Double-check deletion status before adding
        if (!isConversationDeleted(peerAddress)) {
          processedConvos.push({
            id: conversation.context?.conversationId || conversation.topic,
            peerAddress,
            messages: processedMessages,
            preview: processedMessages[processedMessages.length - 1]?.content || '',
            lastMessage: processedMessages[processedMessages.length - 1]?.content || '',
            lastMessageTimestamp: processedMessages[processedMessages.length - 1]?.sent.getTime() || Date.now(),
            unreadCount: 0,
            sharedNFTs
          });
        }
      }

      setConversations(processedConvos);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [client, getCachedNFTs]);

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
    isSwitchingChat,
    setIsSwitchingChat,
    userNFTs,
    availableGroupChats,
    toggleGroupChat,
    markConversationAsRead,
    selectConversation,
    isLoadingConversations,
    deleteConversation,
  } as const
} 