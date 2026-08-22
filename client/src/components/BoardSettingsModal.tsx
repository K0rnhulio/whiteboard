import React, { useState } from 'react';
import { X, Settings, Lock, Trash2, Check, UserCheck } from 'lucide-react';
import { updateBoard, deleteBoard } from '../services/api';

interface BoardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  currentName: string;
  currentTeamPrefix?: string;
  hasPasscode: boolean;
  onUpdated: (newName: string, hasPasscode: boolean, teamPrefix?: string) => void;
  onDeleted: () => void;
}

export const BoardSettingsModal: React.FC<BoardSettingsModalProps> = ({
  isOpen,
  onClose,
  boardId,
  currentName,
  currentTeamPrefix,
  hasPasscode,
  onUpdated,
  onDeleted,
}) => {
  const [name, setName] = useState(currentName);
  const [teamPrefix, setTeamPrefix] = useState(currentTeamPrefix || '');
  const [passcode, setPasscode] = useState('');
  const [removePasscode, setRemovePasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: { name: string; passcode?: string | null; teamPrefix?: string } = {
        name: name.trim() || boardId,
        teamPrefix: teamPrefix.trim() || undefined,
      };

      if (removePasscode) {
        payload.passcode = null;
      } else if (passcode.trim()) {
        payload.passcode = passcode.trim();
      }

      await updateBoard(boardId, payload);
      onUpdated(payload.name, removePasscode ? false : Boolean(passcode.trim() || hasPasscode), payload.teamPrefix);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    try {
      await deleteBoard(boardId);
      onDeleted();
    } catch (err: any) {
      setError(err.message || 'Failed to delete board');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-slate-800 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Board Settings</h2>
            <p className="text-xs text-slate-500 font-mono">ID: {boardId}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Whiteboard Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Auto-Name Team Prefix
            </label>
            <input
              type="text"
              placeholder="e.g. HiltonTeam, Client 1 Team"
              value={teamPrefix}
              onChange={(e) => setTeamPrefix(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              New users joining will be automatically named: {teamPrefix || name || 'Client'} 1, 2, 3...
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              {hasPasscode ? 'Update Room Passcode' : 'Set Room Passcode (Optional)'}
            </label>
            <input
              type="password"
              placeholder={hasPasscode ? 'Enter new passcode (or leave blank to keep)' : 'Leave empty for open access'}
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setRemovePasscode(false);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium"
            />
            {hasPasscode && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={removePasscode}
                  onChange={(e) => {
                    setRemovePasscode(e.target.checked);
                    if (e.target.checked) setPasscode('');
                  }}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                Remove passcode (make public link)
              </label>
            )}
          </div>

          <div className="pt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                confirmDelete
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'text-red-600 hover:bg-red-50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDelete ? 'Confirm Delete' : 'Delete Board'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
