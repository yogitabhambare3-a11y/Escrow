import { Toaster } from 'react-hot-toast';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { useWallet } from './hooks/useWallet';

export default function App() {
  const { wallet, connect, disconnect } = useWallet();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        address={wallet.address}
        isConnecting={wallet.isConnecting}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      <main>
        <Dashboard
          walletAddress={wallet.address}
          onConnect={connect}
        />
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '12px',
            fontSize: '14px',
          },
        }}
      />
    </div>
  );
}
