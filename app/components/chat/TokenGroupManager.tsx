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
            <div key={token.contractAddress} className="flex items-center justify-between p-2 border rounded">
              <div>
                <div className="font-medium">{token.contractName}</div>
                <div className="text-sm text-gray-500">{token.contractAddress}</div>
              </div>
              <button
                onClick={() => onToggleGroup(token.contractAddress)}
                className={`px-4 py-2 rounded ${
                  group?.joined 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {group?.joined ? 'Leave' : 'Join'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
} 