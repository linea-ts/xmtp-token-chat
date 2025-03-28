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
      <div className="connect-bar-bg border-b px-7 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-0">
            <CopyableAddress address={address} className="text-sm" />
            <div
              onClick={() => setIsProfileOpen(true)}
              className="p-1.5 hover:bg-transparent rounded-full transition-colors duration-150 ease-in-out cursor-pointer"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 text-gray-400 hover:text-gray-600" 
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
          className="p-1.5 hover:bg-transparent rounded-full transition-colors duration-150 ease-in-out cursor-pointer"
          title="Disconnect"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-400 hover:text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
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