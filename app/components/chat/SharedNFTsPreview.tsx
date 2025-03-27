import { useState, useRef, useEffect } from 'react';
import { TokenInfo } from '@/app/utils/tokenUtils';

interface SharedNFTsPreviewProps {
  nfts: TokenInfo[];
}

export const SharedNFTsPreview = ({ nfts }: SharedNFTsPreviewProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Get unique contract names
  const uniqueContracts = Array.from(new Set(nfts.map(nft => ({
    name: nft.contractName,
    address: nft.contractAddress
  }))));

  // Handle clicking outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!nfts?.length) return null;

  return (
    <div className="relative">
      <div className="text-xs text-gray-400 flex items-center gap-1">
        <span>{uniqueContracts[0].name}</span>
        {uniqueContracts.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(!showTooltip);
            }}
            className="text-blue-500 hover:text-blue-700"
          >
            +{uniqueContracts.length - 1} more
          </button>
        )}
      </div>

      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute left-0 top-6 z-50 bg-white border rounded-lg shadow-lg p-4 min-w-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Mutual Collections</h3>
            <button
              onClick={() => setShowTooltip(false)}
              className="text-gray-500 hover:text-gray-700 pl-4"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {uniqueContracts.map(contract => (
              <div key={contract.address} className="text-xs">
                {contract.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 