import React, { useState } from 'react';
import { X, Copy, Check, Link2, Shield, Edit3, MessageSquare, Eye } from 'lucide-react';
import { UserRole } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
  hasPasscode: boolean;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  boardId,
  boardName,
  hasPasscode,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('editor');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/board/${boardId}${selectedRole === 'commenter' ? '?role=commenter' : ''}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 text-slate-800 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Share Whiteboard Link</h2>
            <p className="text-xs text-slate-500">Clients can join instantly without an account</p>
          </div>
        </div>

        {/* Role Picker */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Link Access Permission
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedRole('editor')}
              className={`flex flex-col p-3 rounded-xl border text-left transition cursor-pointer ${
                selectedRole === 'editor'
                  ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-800 mb-1">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>Editor</span>
              </div>
              <p className="text-xs text-slate-500">
                Can draw shapes, paste images, edit elements, and write comments.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('commenter')}
              className={`flex flex-col p-3 rounded-xl border text-left transition cursor-pointer ${
                selectedRole === 'commenter'
                  ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-800 mb-1">
                <MessageSquare className="w-4 h-4 text-purple-600" />
                <span>Commenter Only</span>
              </div>
              <p className="text-xs text-slate-500">
                Canvas is locked for viewing only; can drop comment pins & reply.
              </p>
            </button>
          </div>
        </div>

        {/* Link box */}
        <div className="mb-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Shareable URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-700 select-all focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        {hasPasscode && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
            <Shield className="w-4 h-4 shrink-0 text-amber-600" />
            <span>This board is passcode-protected. Clients will be asked for the passcode when they open the link.</span>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
