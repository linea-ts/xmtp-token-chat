const DELETED_CHATS_KEY = 'deleted_chats';

interface DeletedChat {
  peerAddress: string;
  groupName?: string;
  deletedAt: number;
}

export const getDeletedChats = (): DeletedChat[] => {
  try {
    const chats = localStorage.getItem(DELETED_CHATS_KEY);
    return chats ? JSON.parse(chats) : [];
  } catch (error) {
    console.error('Error reading deleted chats:', error);
    return [];
  }
};

export const addDeletedChat = (peerAddress: string, groupName?: string) => {
  const deletedChats = getDeletedChats();
  const normalizedPeerAddress = peerAddress.toLowerCase();
  
  // Remove any existing entry for this peer
  const filteredChats = deletedChats.filter(chat => 
    chat.peerAddress.toLowerCase() !== normalizedPeerAddress
  );
  
  // Add new entry
  filteredChats.push({
    peerAddress: normalizedPeerAddress,
    groupName,
    deletedAt: Date.now()
  });
  
  localStorage.setItem(DELETED_CHATS_KEY, JSON.stringify(filteredChats));
};

export const isConversationDeleted = (peerAddress: string, groupName?: string): boolean => {
  const deletedChats = getDeletedChats();
  const normalizedPeerAddress = peerAddress.toLowerCase();
  
  return deletedChats.some(chat => {
    const addressMatch = chat.peerAddress.toLowerCase() === normalizedPeerAddress;
    
    // For direct messages (no groupName)
    if (!groupName && !chat.groupName) {
      return addressMatch;
    }
    
    // For group chats
    return addressMatch && chat.groupName === groupName;
  });
};

export const removeFromDeletedChats = (peerAddress: string, groupName?: string) => {
  const deletedChats = getDeletedChats();
  const normalizedPeerAddress = peerAddress.toLowerCase();
  
  const filteredChats = deletedChats.filter(chat => 
    chat.peerAddress.toLowerCase() !== normalizedPeerAddress ||
    chat.groupName !== groupName
  );
  
  localStorage.setItem(DELETED_CHATS_KEY, JSON.stringify(filteredChats));
}; 