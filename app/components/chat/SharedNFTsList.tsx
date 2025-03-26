'use client'

import { useState, useRef } from 'react'
import { TokenInfo } from '@/app/utils/tokenUtils'
import { CopyableAddress } from '../common/CopyableAddress'

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
    ? truncateText(nfts[0].contractName)
    : `${truncateText(nfts[0].contractName)} + ${nfts.length - 1} more`

  return (
    <div className="text-sm">
      <span className="text-gray-600">Mutual NFTs:</span>
      <div className="flex flex-wrap gap-1 mt-1">
        {nfts.map((nft) => (
          <span
            key={nft.contractAddress}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
          >
            {nft.contractName}
          </span>
        ))}
      </div>
    </div>
  )
} 