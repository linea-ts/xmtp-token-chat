import { TokenInfo } from "@/app/utils/tokenUtils"

interface SharedNFTsDisplayProps {
  nfts: TokenInfo[]
}

export const SharedNFTsDisplay = ({ nfts }: SharedNFTsDisplayProps) => {
  if (!nfts || nfts.length === 0) return null

  const truncateText = (text: string, maxLength: number = 20) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  }

  if (nfts.length === 1) {
    return (
      <span className="text-sm text-gray-500">
        {truncateText(nfts[0].name)}
      </span>
    )
  }

  return (
    <span className="text-sm text-gray-500">
      {truncateText(nfts[0].name)} + {nfts.length - 1} more
    </span>
  )
} 