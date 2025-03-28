import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TokenInfo } from '@/app/utils/tokenUtils';

interface SharedNFTsPreviewProps {
  nfts: TokenInfo[];
}

export const SharedNFTsPreview = ({ nfts }: SharedNFTsPreviewProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const uniqueContracts = Array.from(new Set(nfts.map(nft => ({
    name: nft.contractName,
    address: nft.contractAddress
  }))));

  useEffect(() => {
    const updatePosition = () => {
      if (showTooltip && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const tooltipHeight = 120; // Approximate height of tooltip
        const scrollY = window.scrollY;
        
        // Calculate available space below
        const spaceBelow = viewportHeight - rect.bottom;
        // Calculate available space above
        const spaceAbove = rect.top;

        let top;
        if (spaceBelow >= tooltipHeight) {
          // Position below if there's enough space
          top = rect.bottom + scrollY + 4;
        } else if (spaceAbove >= tooltipHeight) {
          // Position above if there's enough space
          top = rect.top + scrollY - tooltipHeight - 4;
        } else {
          // If neither above nor below has enough space, position where there's more space
          top = spaceBelow > spaceAbove
            ? rect.bottom + scrollY + 4
            : rect.top + scrollY - tooltipHeight - 4;
        }

        setTooltipPosition({
          top,
          left: rect.left
        });
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showTooltip]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target);
      const isOutsideTooltip = tooltipRef.current && !tooltipRef.current.contains(target);
      
      if (isOutsideContainer && isOutsideTooltip) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTooltip]);

  if (!nfts?.length) return null;

  return (
    <div className="relative" ref={containerRef}>
      <div className="text-xs text-gray-400 flex items-center gap-1">
        <a 
          href={`https://lineascan.build/address/${uniqueContracts[0].address}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="hover:text-blue-500 transition-colors"
        >
          {uniqueContracts[0].name}
        </a>
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

      {showTooltip && createPortal(
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
          className="bg-white border rounded-lg shadow-lg p-4 min-w-[200px] z-[9999]"
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
              <a
                key={contract.address}
                href={`https://lineascan.build/address/${contract.address}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block text-xs hover:text-blue-500 transition-colors"
              >
                {contract.name}
              </a>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};