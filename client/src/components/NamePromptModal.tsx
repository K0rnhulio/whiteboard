import React, { useState } from 'react';
import { User, Sparkles } from 'lucide-react';

interface NamePromptModalProps {
  isOpen: boolean;
  boardName: string;
  defaultName: string;
  defaultColor: string;
  onSubmit: (name: string, color: string) => void;
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ef4444', // red
  '#14b8a6', // teal
];

export const NamePromptModal: React.FC<NamePromptModalProps> = ({
  isOpen,
  boardName,
  defaultName,
  defaultColor,
  onSubmit,
}) => {
  const [name, setName] = useState(defaultName || '');
  const [color, setColor] = useState(defaultColor || PRESET_COLORS[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || `Guest ${Math.floor(1000 + Math.random() * 9000)}`;
    onSubmit(finalName, color);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-slate-800">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-4 mx-auto">
          <Sparkles className="w-6 h-6" />
        </div>

        <h2 className="text-xl font-bold text-center text-slate-900 mb-1">
          Join Whiteboard
        </h2>
        <p className="text-sm text-center text-slate-500 mb-6">
          You are joining <span className="font-semibold text-slate-700">{boardName}</span>. No login required.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Your Name / Nickname
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="e.g. Sarah from Marketing"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition"
                maxLength={40}
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Choose Avatar Color
            </label>
            <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-110 opacity-80'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
          >
            Enter Whiteboard
          </button>
        </form>
      </div>
    </div>
  );
};
