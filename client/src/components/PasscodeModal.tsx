import React, { useState } from 'react';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';

interface PasscodeModalProps {
  isOpen: boolean;
  boardName: string;
  onVerify: (passcode: string) => Promise<boolean>;
  onSuccess: () => void;
}

export const PasscodeModal: React.FC<PasscodeModalProps> = ({
  isOpen,
  boardName,
  onVerify,
  onSuccess,
}) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) {
      setError('Please enter the passcode');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const valid = await onVerify(passcode);
      if (valid) {
        onSuccess();
      } else {
        setError('Incorrect passcode. Please check with the board owner.');
      }
    } catch {
      setError('Failed to verify passcode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-slate-800">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 text-amber-600 mb-4 mx-auto">
          <Lock className="w-6 h-6" />
        </div>

        <h2 className="text-xl font-bold text-center text-slate-900 mb-1">
          Passcode Protected
        </h2>
        <p className="text-xs text-center text-slate-500 mb-6">
          <span className="font-semibold text-slate-700">{boardName}</span> requires a passcode to enter.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Enter Room Passcode
            </label>
            <input
              type="password"
              autoFocus
              placeholder="••••••••"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-medium transition tracking-widest text-center"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Unlock Board'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
