import { Logo } from '../shared/Logo';

interface HeaderProps {
  onCreateGroup: () => void;
}

export const Header = ({ onCreateGroup }: HeaderProps) => {
  return (
    <header className="bg-white border-b shadow-sm py-4">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Logo />
            </div>
            <span className="text-sm text-gray-500 hidden sm:inline">
              Connect with fellow memecoin/NFT holders on Linea! the fastest and cheapest zkEVM chain.
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onCreateGroup}
              className="btn-primary"
            >
              Create Group
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}; 