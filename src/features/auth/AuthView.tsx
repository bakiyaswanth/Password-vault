import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { PasswordStrengthMeter } from '../generator/PasswordStrengthMeter';
import { RecoveryModal } from './RecoveryModal';
import { useAuth } from '../../context/AuthContext';

export const AuthView: React.FC = () => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState(''); // Email or Username for Login
  const [username, setUsername] = useState(''); // Registration username (Required)
  const [email, setEmail] = useState(''); // Registration email (Optional)
  const [skipEmail, setSkipEmail] = useState(false); // "Skip for now" state
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enableRecovery, setEnableRecovery] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);

  const { login, register, isLoading, error: authError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (tab === 'login') {
      if (!identifier.trim() || !masterPassword) {
        setLocalError('Please enter your username or email and master password.');
        return;
      }
      await login(identifier.trim(), masterPassword);
    } else {
      if (!username.trim()) {
        setLocalError('Please enter a username.');
        return;
      }

      if (username.includes('@')) {
        setLocalError('Username cannot contain the @ symbol. Please enter a valid username (e.g. dev-user).');
        return;
      }

      if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim())) {
        setLocalError('Username must be between 3 and 30 characters (letters, numbers, dots, dashes, underscores).');
        return;
      }

      const emailToSubmit = skipEmail ? '' : email.trim();
      if (emailToSubmit && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToSubmit)) {
        setLocalError('Please enter a valid email address, or check "Skip for now".');
        return;
      }

      if (!masterPassword) {
        setLocalError('Please enter a master password.');
        return;
      }

      if (masterPassword.length < 12) {
        setLocalError('Master password must be at least 12 characters.');
        return;
      }

      if (masterPassword !== confirmPassword) {
        setLocalError('Master passwords do not match.');
        return;
      }

      await register({
        username: username.trim(),
        email: emailToSubmit || undefined,
        masterPass: masterPassword,
        enableRecovery,
      });
    }
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-vault-600 to-vault-500 text-white shadow-lg shadow-vault-500/25 mb-1">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Surakshit Vault
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Zero-Knowledge, Client-Side Encrypted Personal Vault
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl shadow-gray-200/50 dark:shadow-none space-y-6">
          {/* Tab Switcher */}
          <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
            <button
              type="button"
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === 'login'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              onClick={() => {
                setTab('login');
                setLocalError(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === 'register'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              onClick={() => {
                setTab('register');
                setLocalError(null);
              }}
            >
              Create Vault
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* LOGIN MODE */}
            {tab === 'login' ? (
              <Input
                label="Username or Email"
                type="text"
                placeholder="e.g. dev-user or name@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disableSelection
                required
              />
            ) : (
              /* REGISTER MODE */
              <>
                <Input
                  label="Username (Required)"
                  type="text"
                  placeholder="e.g. dev-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disableSelection
                  required
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Email Address <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSkipEmail(!skipEmail);
                        if (!skipEmail) setEmail('');
                      }}
                      className="text-[11px] font-medium text-vault-600 hover:text-vault-700 dark:text-vault-400"
                    >
                      {skipEmail ? 'Enter email' : 'Skip for now'}
                    </button>
                  </div>

                  {!skipEmail ? (
                    <Input
                      type="email"
                      placeholder="name@example.com (optional)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disableSelection
                    />
                  ) : (
                    <div className="p-2.5 rounded-lg border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-xs text-gray-500 flex items-center justify-between">
                      <span>Email skipped. You can add an email later in Account Settings.</span>
                      <button
                        type="button"
                        onClick={() => setSkipEmail(false)}
                        className="text-vault-600 font-semibold hover:underline ml-2 shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <Input
                label="Master Password (Required)"
                isPassword
                placeholder="Enter your master password (min 12 chars)"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                disableSelection
                required
              />
              {tab === 'register' && masterPassword && (
                <PasswordStrengthMeter password={masterPassword} />
              )}
            </div>

            {tab === 'register' && (
              <Input
                label="Confirm Master Password"
                isPassword
                placeholder="Confirm your master password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disableSelection
                required
              />
            )}

            {tab === 'register' && (
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={enableRecovery}
                  onChange={(e) => setEnableRecovery(e.target.checked)}
                  className="rounded text-vault-600 focus:ring-vault-500 mt-0.5"
                />
                <div>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block">
                    Generate 24-Word Emergency Recovery Key
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-[11px]">
                    Recommended. Allows recovering your vault if you lose your master password.
                  </span>
                </div>
              </label>
            )}

            {activeError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{activeError}</span>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              type="submit"
              isLoading={isLoading}
            >
              {tab === 'login' ? 'Unlock & Sign In' : 'Create Zero-Knowledge Vault'}
            </Button>
          </form>

          {tab === 'login' && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsRecoveryOpen(true)}
                className="text-xs text-vault-600 hover:text-vault-700 dark:text-vault-400 font-medium transition-colors"
              >
                Forgot master password? Recover with 24-word phrase
              </button>
            </div>
          )}
        </div>

        {/* Security Assurance */}
        <div className="text-center text-[11px] text-gray-400 space-y-1">
          <p className="flex items-center justify-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-shield-500" />
            End-to-End Encrypted (Argon2id + AES-256-GCM)
          </p>
          <p>Your master password and plaintext keys never leave this device.</p>
        </div>
      </div>

      <RecoveryModal isOpen={isRecoveryOpen} onClose={() => setIsRecoveryOpen(false)} />
    </div>
  );
};
