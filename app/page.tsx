import Chat from './components/Chat'

export default function Home() {
  return (
    <>
      <main>
        <Chat />
      </main>
      <footer className="fixed bottom-0 left-0 right-0 bg-[#60dfff] py-4 text-center text-sm">
        <span className="text-blue-900">
          <a href="#" className="hover:underline">Privacy Policy</a>
          {' | '}
          <a href="#" className="hover:underline">Terms of Service</a>
        </span>
      </footer>
    </>
  )
}
