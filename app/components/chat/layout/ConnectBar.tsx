import { CopyableAddress } from '../../common/CopyableAddress';

interface ConnectBarProps {
  address: string;
  onDisconnect: () => void;
}

export const ConnectBar = ({ address, onDisconnect }: ConnectBarProps) => {
  return (
    <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <CopyableAddress address={address} className="text-sm" />
      </div>
      <button
        onClick={onDisconnect}
        className="text-sm text-gray-600 hover:text-gray-800"
      >
        Disconnect
      </button>
    </div>
  );
}; 