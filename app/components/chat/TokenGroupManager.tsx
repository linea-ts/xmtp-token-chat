import { TokenInfo } from '@/app/utils/tokenUtils'
import { useState, useEffect } from 'react'

interface TokenGroupManagerProps {
  userNFTs: TokenInfo[]
  availableGroupChats: {
    contractAddress: string
    name: string
    joined: boolean
  }[]
  onToggleGroup: (contractAddress: string) => void
}

interface OwnershipData {
  owners: string[]
}

export const TokenGroupManager = ({ 
  userNFTs, 
  availableGroupChats, 
  onToggleGroup 
}: TokenGroupManagerProps) => {
  const [ownerCounts, setOwnerCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchOwnerCounts = async () => {
      const counts: Record<string, number> = {};
      
      for (const token of userNFTs) {
        try {
          const response = await fetch(
            `https://linea-mainnet.g.alchemy.com/nft/v3/14LeArNcs0QPhVKPglj6kX4mBobvDFd5/getOwnersForContract?contractAddress=${token.contractAddress}&withTokenBalances=false`
          );
          const data: OwnershipData = await response.json();
          counts[token.contractAddress] = data.owners.length;
        } catch (error) {
          console.error(`Error fetching owner count for ${token.contractAddress}:`, error);
          counts[token.contractAddress] = 0;
        }
      }
      
      setOwnerCounts(counts);
    };

    fetchOwnerCounts();
  }, [userNFTs]);

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto space-y-2">
        {userNFTs.map(token => {
          const group = availableGroupChats.find(g => 
            g.contractAddress.toLowerCase() === token.contractAddress.toLowerCase()
          )
          
          return (
            <div key={token.contractAddress} className="grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-2 p-2 border rounded">
              <div className="min-w-0 pr-2">
                <a
                  href={`https://lineascan.build/address/${token.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium hover:text-blue-500 transition-colors truncate block"
                >
                  {token.contractName}
                </a>
                <div className="text-sm text-gray-500 font-mono">
                  {ownerCounts[token.contractAddress] === undefined ? (
                    'Loading holders...'
                  ) : ownerCounts[token.contractAddress] >= 50000 ? (
                    '>50,000 holders'
                  ) : (
                    `${ownerCounts[token.contractAddress].toLocaleString()} holders`
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded">
                  Coming Soon
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 