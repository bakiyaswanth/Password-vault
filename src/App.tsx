import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VaultProvider } from './context/VaultContext';
import { AuthView } from './features/auth/AuthView';
import { UnlockView } from './features/auth/UnlockView';
import { AppLayout } from './components/layout/AppLayout';
import { ShieldCheck, Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLocked, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-vault-600 flex items-center justify-center text-white shadow-lg shadow-vault-600/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin text-vault-600" />
            <span>Initializing Surakshit Zero-Knowledge Engine...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  if (isLocked) {
    return <UnlockView />;
  }

  return (
    <VaultProvider>
      <AppLayout />
    </VaultProvider>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
