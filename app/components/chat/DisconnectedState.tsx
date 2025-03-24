import { Footer } from './layout/Footer'

interface DisconnectedStateProps {
  isLoading: boolean;
  onConnect: () => void;
}

export const DisconnectedState = ({ isLoading, onConnect }: DisconnectedStateProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {isLoading ? (
          <div className="flex flex-col items-center space-y-4 animate-fade-in">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
            <p className="text-lg text-gray-600">Connecting to chat...</p>
          </div>
        ) : (
          <div className="animate-fade-in">
            <img 
              src="/bgtransparent.png" 
              alt="Disconnected State" 
              className="mx-auto mb-8 w-[300px] h-auto"
            />
            <div className="w-full max-w-5xl">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center mb-4">
                  <div className="section_headline__nyvPb flex items-center">
                    <span className="section_icon__QAGu9">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" className="w-12 h-12">
                        <circle cx="16" cy="16" r="16" fill="rgb(255 228 85)"></circle>
                        <g fill="#121212">
                          <path d="M22.218 22.914H9.333V9.338h2.948v10.945h9.937v2.631M22.219 11.967a2.63 2.63 0 1 0 0-5.26 2.63 2.63 0 0 0 0 5.26"></path>
                        </g>
                      </svg>
                    </span>
                    <h3 className="section_title__llN6N text-4xl font-bold ml-1">TokenTalk</h3>
                  </div>
                </div>
                <p className="text-xl text-gray-600">Connect with fellow memecoin/NFT holders on Linea! the fastest and cheapest zkEVM network.</p>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={onConnect}
                  className="btn-primary text-lg px-8 py-3 rounded-[40px]"
                >
                  Login with Your Wallet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}; 