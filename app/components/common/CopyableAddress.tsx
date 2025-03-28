import { useState } from 'react';
import { truncateEthAddress } from '@/app/utils/truncateEthAddress';

interface CopyableAddressProps {
  address: string;
  truncate?: boolean;
  className?: string;
}

export const CopyableAddress = ({ address, truncate = true, className = '' }: CopyableAddressProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 group ${className}`}>
      <span className="font-mono">
        {truncate ? truncateEthAddress(address) : address}
      </span>
      <button
        onClick={handleCopy}
        className="p-1 rounded-full hover:bg-transparent transition-colors"
        title="Copy address"
      >
        {copied ? (
          <svg
            className="w-4 h-4 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-gray-400 group-hover:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
            />
          </svg>
        )}
      </button>
    </div>
  );
}; 