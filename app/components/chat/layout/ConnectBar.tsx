import { useState } from 'react';
import { CopyableAddress } from '../../common/CopyableAddress';
import { ProfileModal } from '../../profile/ProfileModal';

interface ConnectBarProps {
  address: string;
  onDisconnect: () => void;
}

export const ConnectBar = ({ address, onDisconnect }: ConnectBarProps) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <div className="connect-bar-bg border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div
            onClick={() => setIsProfileOpen(true)}
            className="group px-3 py-1.5 hover:bg-yellow-50 rounded-lg transition-colors duration-150 ease-in-out cursor-pointer"
          >
            <div className="flex items-center space-x-1">
              <CopyableAddress address={address} className="text-sm group-hover:text-yellow-700" />
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 text-gray-400 group-hover:text-yellow-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>
        <button
          onClick={onDisconnect}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Disconnect
        </button>
      </div>

      <ProfileModal
        address={address}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  );
}; 