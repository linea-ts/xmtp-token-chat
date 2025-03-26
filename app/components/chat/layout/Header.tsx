import { Logo } from '../shared/Logo';

export const Header = () => {
  return (
    <header className="bg-white border-b shadow-sm py-4">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Logo />
            </div>
            <span className="text-sm text-gray-500 hidden sm:inline">
              Connect with fellow memecoin/NFT holders on Linea! the fastest and cheapest zkEVM network.
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}; 