import { Alchemy, Network, OwnedNft } from 'alchemy-sdk';

// Configure Alchemy SDK
const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.LINEA_MAINNET
};

const alchemy = new Alchemy(config);

export interface TokenInfo {
  contractAddress: string;
  contractName: string;
  tokenType: string;
  name: string;
}

export async function getAllNFTs(walletAddress: string): Promise<TokenInfo[]> {
  try {
    const nftsResponse = await alchemy.nft.getNftsForOwner(walletAddress);
    
    // Create a Map to deduplicate by contract address
    const contractMap = new Map<string, TokenInfo>();
    
    nftsResponse.ownedNfts.forEach((nft: OwnedNft) => {
      const contractAddress = nft.contract.address.toLowerCase();
      if (!contractMap.has(contractAddress)) {
        contractMap.set(contractAddress, {
          contractAddress: contractAddress,
          contractName: nft.contract.name || 'Unknown Contract',
          tokenType: nft.tokenType,
          name: nft.contract.name || 'Unknown NFT'
        });
      }
    });
    
    // Convert Map to array
    return Array.from(contractMap.values());
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    return [];
  }
}

export const getSharedNFTs = (userNFTs: TokenInfo[], peerNFTs: TokenInfo[]): TokenInfo[] => {
  return userNFTs.filter(userNFT => 
    peerNFTs.some(peerNFT => 
      peerNFT.contractAddress.toLowerCase() === userNFT.contractAddress.toLowerCase()
    )
  );
};

export const hasMatchingNFTs = (userNFTs: TokenInfo[], peerNFTs: TokenInfo[]): boolean => {
  return getSharedNFTs(userNFTs, peerNFTs).length > 0;
}; 