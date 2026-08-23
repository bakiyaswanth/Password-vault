import React from 'react';
import { calculatePasswordEntropy } from '../../crypto/password-gen';

export const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;

  const { entropyBits, strength, color } = calculatePasswordEntropy(password);

  const labels = {
    'very-weak': 'Very Weak',
    weak: 'Weak',
    fair: 'Fair',
    strong: 'Strong',
    'very-strong': 'Very Strong',
  };

  const getPercentage = () => {
    return Math.min(100, Math.max(10, (entropyBits / 100) * 100));
  };

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          Strength: <span className="font-semibold" style={{ color }}>{labels[strength]}</span>
        </span>
        <span className="font-mono text-gray-400 dark:text-gray-500">
          ~{entropyBits} bits of entropy
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full transition-all duration-300 rounded-full"
          style={{ width: `${getPercentage()}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};
