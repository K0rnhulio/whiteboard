import React, { useState } from 'react';
import { Users, Edit2, Check, Shield } from 'lucide-react';
import { CollaboratorUser } from '../types';

interface CollaboratorsListProps {
  collaborators: CollaboratorUser[];
  currentSocketId: string;
  onUpdateProfile: (name: string, color: string) => void;
}

export const CollaboratorsList: React.FC<CollaboratorsListProps> = ({
  collaborators,
  currentSocketId,
  onUpdateProfile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const currentUser = collaborators.find((c) => c.socketId === currentSocketId);
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editColor, setEditColor] = useState(currentUser?.color || '#3b82f6');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim()) {
      onUpdateProfile(editName.trim(), editColor);
      setIsEditing(false);
    }
  };

  const PRESET_COLORS = [
    '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#ef4444', '#14b8a6'
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-slate-200/80 shadow-sm backdrop-blur text-xs font-semibold text-slate-700 transition cursor-pointer"
        title="Active collaborators"
      >
        <div className="flex -space-x-1.5 overflow-hidden py-0.5">
          {collaborators.slice(0, 4).map((user) => (
            <div
              key={user.socketId}
              className="inline-block h-5 w-5 rounded-full ring-2 ring-white text-[10px] font-bold text-white flex items-center justify-center uppercase shrink-0"
              style={{ backgroundColor: user.color }}
              title={`${user.name} (${user.role})`}
            >
              {user.name.charAt(0) || 'U'}
            </div>
          ))}
        </div>
        <span className="ml-1 text-slate-600 font-medium">{collaborators.length}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-500">
              <Users className="w-3.5 h-3.5" />
              <span>Participants ({collaborators.length})</span>
            </div>
            {!isEditing && (
              <button
                onClick={() => {
                  setEditName(currentUser?.name || '');
                  setEditColor(currentUser?.color || '#3b82f6');
                  setIsEditing(true);
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                Edit Profile
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-3 mb-3 p-3 bg-slate-50 rounded-xl">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Color
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-5 h-5 rounded-full ${editColor === c ? 'ring-2 ring-slate-800 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
              </div>
            </form>
          ) : null}

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {collaborators.map((user) => {
              const isSelf = user.socketId === currentSocketId;
              return (
                <div
                  key={user.socketId}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center uppercase shrink-0"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate flex items-center gap-1">
                        <span>{user.name}</span>
                        {isSelf && <span className="text-[10px] text-slate-400 font-normal">(You)</span>}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      user.role === 'editor'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
