import { TokenInfo } from '../../utils/tokenUtils'

interface TokenGroupManagerProps {
  userNFTs: TokenInfo[]
  availableGroupChats: {
    contractAddress: string
    name: string
    joined: boolean
  }[]
  onToggleGroup: (contractAddress: string) => void
}

export const TokenGroupManager = ({ 
  userNFTs, 
  availableGroupChats, 
  onToggleGroup 
}: TokenGroupManagerProps) => {
  return (
    <div className="border rounded p-4 mb-4">
      <h2 className="font-semibold mb-2">Token Group Chats</h2>
      <div className="space-y-2">
        {userNFTs.map(token => {
          const group = availableGroupChats.find(g => 
            g.contractAddress.toLowerCase() === token.contractAddress.toLowerCase()
          )
          
          return (
            <div key={token.contractAddress} className="grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-2 p-2 border rounded">
              <div className="min-w-0 pr-2">
                <div className="font-medium truncate">{token.contractName}</div>
                <div className="text-sm text-gray-500 truncate">{token.contractAddress}</div>
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