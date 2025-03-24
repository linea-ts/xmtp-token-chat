'use client'

import { useState, useRef } from 'react'
import { TokenInfo } from '@/app/utils/tokenUtils'

interface SharedNFTsListProps {
  nfts: TokenInfo[]
}

export const SharedNFTsList = ({ nfts }: SharedNFTsListProps) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  if (!nfts || nfts.length === 0) return null

  const truncateText = (text: string, maxLength: number = 20) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  }

  const displayText = nfts.length === 1 
    ? truncateText(nfts[0].name)
    : `${truncateText(nfts[0].name)} + ${nfts.length - 1} more`

  return (
    <div className="relative inline-block">
      <span
        className="text-sm text-gray-500 cursor-pointer hover:underline"
        onClick={(e) => {
          e.stopPropagation()
          setShowTooltip(!showTooltip)
        }}
      >
        {displayText}
      </span>
      
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px] right-0 mt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Shared NFTs</h3>
            <button
              onClick={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {nfts.map((nft, index) => (
              <div
                key={`${nft.contractAddress}-${nft.tokenId}`}
                className="p-2 hover:bg-gray-50 rounded"
              >
                <div className="font-medium">{nft.name}</div>
                <div className="text-xs text-gray-500">
                  {truncateText(nft.contractAddress, 12)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 