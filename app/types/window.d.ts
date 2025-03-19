interface Ethereum {
  request: (args: { method: string; params?: any[] }) => Promise<any>
  selectedAddress: string
  isMetaMask?: boolean
}

declare global {
  interface Window {
    ethereum?: Ethereum
  }
}

export {} 