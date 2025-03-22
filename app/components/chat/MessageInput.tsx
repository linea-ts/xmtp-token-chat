interface MessageInputProps {
  message: string;
  setMessage: (message: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const MessageInput = ({ message, setMessage, onSubmit }: MessageInputProps) => {
  return (
    <form onSubmit={onSubmit} className="flex gap-2 bg-white p-2 rounded">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message"
        className="flex-1 p-2 border rounded"
        onKeyPress={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (message.trim()) {
              onSubmit(e);
            }
          }
        }}
      />
      <button
        type="submit"
        className="btn-primary whitespace-nowrap"
      >
        Send
      </button>
    </form>
  );
}; 