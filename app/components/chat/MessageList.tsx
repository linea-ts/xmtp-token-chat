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

  return (
    <div className="flex-1 overflow-y-auto mb-4 space-y-2 h-[600px]">
      {isSwitchingChat ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        </div>
      ) : (
        <div className="animate-fade-in">
          {messages.map((msg, index) => {
            const currentAddress = (window as any).ethereum?.selectedAddress;
            console.log('Message sender:', msg.senderAddress);
            console.log('Current user:', currentAddress);
            
            const isMyMessage = currentAddress && 
              utils.getAddress(msg.senderAddress).toLowerCase() === 
              utils.getAddress(currentAddress).toLowerCase();
            
            console.log('Is my message?', isMyMessage);

            const messageTime = new Date(msg.sent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const messageDate = new Date(msg.sent).toLocaleDateString();
            
            return (
              <div
                key={getMessageId(msg, index)}
                className="flex flex-col w-full"
              >
                <div
                  className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} w-full mb-4`}
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
          {/* Add an empty div at the bottom for scrolling */}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}; 