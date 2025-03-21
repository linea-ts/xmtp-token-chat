export const Footer = () => {
  return (
    <footer className="bg-[rgb(97,223,255,0.67)] py-4">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Built with ❤️ on Linea
          </div>
          <div className="flex space-x-4">
            <a href="https://linea.build" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-gray-900">
              Linea
            </a>
            <a href="https://xmtp.org" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-gray-900">
              XMTP
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}; 