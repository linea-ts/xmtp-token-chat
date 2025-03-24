import { ethers } from 'ethers'

export const LINEA_CHAIN_ID = '0xe708' // 59144 in hex
export const LINEA_CHAIN_CONFIG = {
  chainId: LINEA_CHAIN_ID,
  chainName: 'Linea Mainnet',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['https://rpc.linea.build'],
  blockExplorerUrls: ['https://lineascan.build']
}

export const switchToLinea = async () => {
  if (!window.ethereum) throw new Error('No crypto wallet found')

  try {
    // Try to switch to Linea
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: LINEA_CHAIN_ID }]
    })
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [LINEA_CHAIN_CONFIG]
        })
      } catch (addError) {
        throw new Error('Failed to add Linea network')
      }
    } else {
      throw new Error('Failed to switch to Linea network')
    }
  }
}

export const validateLineaNetwork = async (provider: ethers.providers.Web3Provider) => {
  const network = await provider.getNetwork()
  if (network.chainId !== 59144) {
    throw new Error('Please connect to Linea network')
  }
}

export const setupNetworkMonitoring = (onWrongNetwork: () => Promise<void>) => {
  if (!window.ethereum) return

  window.ethereum.on('chainChanged', async (chainId: string) => {
    if (chainId !== LINEA_CHAIN_ID) {
      await onWrongNetwork()
    }
  })
} 