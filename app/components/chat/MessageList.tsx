import { truncateEthAddress } from '@/app/utils/truncateEthAddress';

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
  return (
    <div className="flex-1 overflow-y-auto mb-4 space-y-2">
      {isSwitchingChat ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        </div>
      ) : (
        <div className="animate-fade-in">
          {messages.map((msg, index) => {
            const isMyMessage = msg.senderAddress === (window as any).ethereum?.selectedAddress;
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
                      ${isMyMessage ? 'bg-yellow-50' : 'bg-white'}`}
                  >
                    <div className="text-xs text-gray-500 mb-1">{truncateEthAddress(msg.senderAddress)}</div>
                    <div className="mb-1">{msg.content}</div>
                    <div className="text-xs text-gray-400">{messageTime} • {messageDate}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}; 