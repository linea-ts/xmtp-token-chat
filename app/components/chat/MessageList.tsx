import { truncateEthAddress } from '@/app/utils/truncateEthAddress';
import { useEffect, useRef } from 'react';
import { utils } from 'ethers';
import { CopyableAddress } from '../common/CopyableAddress';

interface Message {
  id?: string;
  senderAddress: string;
  content: string;
  sent: Date;
}

interface MessageListProps {
  messages: Message[];
  getMessageId: (msg: Message, index: number) => string;
  isSwitchingChat: boolean;
}

export const MessageList = ({ messages, getMessageId, isSwitchingChat }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom when messages change or when switching chats
  useEffect(() => {
    scrollToBottom();
  }, [messages, isSwitchingChat]);

  console.log('MessageList render - isSwitchingChat:', isSwitchingChat);

  return (
    <div className="flex-1 overflow-y-auto">
      {isSwitchingChat ? (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent"></div>
          <p className="text-gray-500 text-lg">Loading messages...</p>
        </div>
      ) : (
        <div className="animate-fade-in space-y-2 p-4">
          {messages.map((msg, index) => {
            const currentAddress = (window as any).ethereum?.selectedAddress;
            
            const isMyMessage = currentAddress && 
              utils.getAddress(msg.senderAddress).toLowerCase() === 
              utils.getAddress(currentAddress).toLowerCase();

            const messageTime = new Date(msg.sent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const messageDate = new Date(msg.sent).toLocaleDateString();
            
            return (
              <div
                key={getMessageId(msg, index)}
                className="flex flex-col w-full"
              >
                <div
                  className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} w-full`}
                >
                  <div
                    className={`p-3 rounded-2xl shadow-sm max-w-[80%] break-words
                      ${isMyMessage ? 'bg-blue-100' : 'bg-white'}`}
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      <CopyableAddress address={msg.senderAddress} />
                    </div>
                    <div className="mb-1">{msg.content}</div>
                    <div className="text-xs text-gray-400">{messageTime} • {messageDate}</div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}; 