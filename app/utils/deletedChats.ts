const DELETED_CHATS_KEY = 'deletedChats';

interface DeletedChat {
  peerAddress: string;
  groupName?: string;
  deletedAt: number;
}

export const getDeletedChats = (): DeletedChat[] => {
  if (typeof window === 'undefined') return [];
  const deleted = localStorage.getItem(DELETED_CHATS_KEY);
  return deleted ? JSON.parse(deleted) : [];
};

export const addDeletedChat = (peerAddress: string, groupName?: string) => {
  const deletedChats = getDeletedChats();
  deletedChats.push({
    peerAddress,
    groupName,
    deletedAt: Date.now()
  });
  localStorage.setItem(DELETED_CHATS_KEY, JSON.stringify(deletedChats));
};

export const isConversationDeleted = (peerAddress: string, groupName?: string): boolean => {
  const deletedChats = getDeletedChats();
  return deletedChats.some(chat => 
    chat.peerAddress === peerAddress && chat.groupName === groupName
  );
};

export const removeFromDeletedChats = (peerAddress: string, groupName?: string) => {
  const deletedChats = getDeletedChats();
  const filtered = deletedChats.filter(chat => 
    !(chat.peerAddress === peerAddress && chat.groupName === groupName)
  );
  localStorage.setItem(DELETED_CHATS_KEY, JSON.stringify(filtered));
}; 