export interface Message {
  id?: string;
  senderAddress: string;
  content: string;
  sent: Date;
}

export interface GroupMetadata {
  name: string;
  members: string[];
}

export interface Conversation {
  id: string;
  peerAddress: string;
  messages: Message[];
  groupMetadata?: GroupMetadata;
  preview?: string;
  lastMessage?: string;
}

export interface ChatState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  messages: Message[];
  conversations: Conversation[];
  selectedConversation: Conversation | null;
} 