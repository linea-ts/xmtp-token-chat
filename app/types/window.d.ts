interface Ethereum {
  request: (args: { method: string; params?: any[] }) => Promise<any>
  selectedAddress: string
  isMetaMask?: boolean
  on: (eventName: string, handler: (...args: any[]) => void) => void
  removeListener: (eventName: string, handler: (...args: any[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: Ethereum
  }
}

export {} 