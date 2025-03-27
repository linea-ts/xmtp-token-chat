import { TokenInfo } from '../utils/tokenUtils';

export interface Message {
  senderAddress: string;
  content: string;
  sent: Date;
}

export interface GroupMetadata {
  name: string;
  members: string[];
  type?: 'token_group' | 'group';
}

export interface Conversation {
  id: string;
  peerAddress: string;
  messages: Message[];
  groupMetadata?: GroupMetadata;
  preview?: string;
  lastMessage?: string;
  sharedNFTs?: TokenInfo[];
  unreadCount: number;
  lastMessageTimestamp: number;
}

export interface ChatState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  messages: Message[];
  conversations: Conversation[];
  selectedConversation: Conversation | null;
} 