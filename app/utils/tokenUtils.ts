import { Alchemy, Network } from 'alchemy-sdk';

// Configure Alchemy SDK
const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.LINEA_MAINNET
};

const alchemy = new Alchemy(config);

export interface TokenInfo {
  contractAddress: string;
  tokenId: string;
  tokenType: string;
  name: string;
}

export async function getAllNFTs(walletAddress: string): Promise<TokenInfo[]> {
  try {
    const nftsResponse = await alchemy.nft.getNftsForOwner(walletAddress);
    
    return nftsResponse.ownedNfts.map(nft => ({
      contractAddress: nft.contract.address,
      tokenId: nft.tokenId,
      tokenType: nft.tokenType,
      name: nft.name || `${nft.contract.name || 'Unknown'} #${nft.tokenId}`
    }));
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    return [];
  }
}

export function hasMatchingNFTs(userNFTs: TokenInfo[], peerNFTs: TokenInfo[]): boolean {
  return userNFTs.some(userNFT => 
    peerNFTs.some(peerNFT => 
      peerNFT.contractAddress.toLowerCase() === userNFT.contractAddress.toLowerCase()
    )
  );
} 