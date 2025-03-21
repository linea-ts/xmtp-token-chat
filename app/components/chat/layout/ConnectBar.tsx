import { truncateEthAddress } from '@/app/utils/truncateEthAddress'

interface ConnectBarProps {
  address: string;
  onDisconnect: () => void;
}

export const ConnectBar = ({ address, onDisconnect }: ConnectBarProps) => {
  return (
    <div className="connect-bar">
      <div className="connect-bar__status">
        <div className="connect-bar__status-dot"></div>
        <span>Connected: {truncateEthAddress(address)}</span>
      </div>
      <button
        onClick={onDisconnect}
        className="connect-bar__disconnect"
        title="Disconnect Wallet"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-black/70">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3h12.75" />
        </svg>
      </button>
    </div>
  );
}; 