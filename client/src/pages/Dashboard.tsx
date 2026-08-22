import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Lock,
  Users,
  MessageSquare,
  Shapes,
  Copy,
  Check,
  ExternalLink,
  Settings,
  Sparkles,
  LayoutGrid,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { fetchBoards, createBoard } from '../services/api';
import { BoardSummary, UserRole } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardSlug, setNewBoardSlug] = useState('');
  const [newBoardPasscode, setNewBoardPasscode] = useState('');
  const [newBoardTeamPrefix, setNewBoardTeamPrefix] = useState('');
  const [createError, setCreateError] = useState('');
  const [copiedBoardId, setCopiedBoardId] = useState<string | null>(null);

  const loadBoards = async () => {
    try {
      setLoading(true);
      const data = await fetchBoards();
      setBoards(data);
    } catch (err) {
      console.error('Failed to load boards', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoards();
  }, []);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    try {
      setCreateError('');
      const slug = newBoardSlug.trim()
        ? newBoardSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-')
        : newBoardName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');

      const created = await createBoard({
        id: slug,
        name: newBoardName.trim(),
        passcode: newBoardPasscode.trim() || undefined,
        teamPrefix: newBoardTeamPrefix.trim() || undefined,
      });

      setIsCreateOpen(false);
      setNewBoardName('');
      setNewBoardSlug('');
      setNewBoardPasscode('');
      setNewBoardTeamPrefix('');
      navigate(`/board/${created.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create whiteboard');
    }
  };

  const handleCopyLink = (boardId: string, role: UserRole = 'editor') => {
    const url = `${window.location.origin}/board/${boardId}${role === 'commenter' ? '?role=commenter' : ''}`;
    navigator.clipboard.writeText(url);
    setCopiedBoardId(`${boardId}-${role}`);
    setTimeout(() => setCopiedBoardId(null), 2000);
  };

  const filteredBoards = boards.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Shapes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                Whiteboard Hub
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Multi-Client Collaborative Whiteboards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Whiteboard</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Search and Stats bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search boards or clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>{boards.length} Boards</span>
            </div>
          </div>
        </div>

        {/* Boards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-6 border border-slate-200 animate-pulse h-48" />
            ))}
          </div>
        ) : filteredBoards.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 max-w-lg mx-auto p-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              {searchQuery ? 'No matching whiteboards' : 'No whiteboards created yet'}
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              {searchQuery
                ? 'Try a different search query'
                : 'Create dedicated whiteboards for your clients (e.g. 1clientwhiteboard, 2clientwhiteboard)'}
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create First Board
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBoards.map((board) => (
              <div
                key={board.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition duration-200 flex flex-col overflow-hidden group"
              >
                {/* Card Top */}
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3
                        onClick={() => navigate(`/board/${board.id}`)}
                        className="font-bold text-base text-slate-900 hover:text-blue-600 truncate cursor-pointer transition"
                      >
                        {board.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-mono text-slate-400 truncate bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                          /board/{board.id}
                        </span>
                        {board.hasPasscode && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                            <Lock className="w-3 h-3" />
                            Passcode
                          </span>
                        )}
                      </div>
                    </div>

                    {board.activeUsersCount !== undefined && board.activeUsersCount > 0 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{board.activeUsersCount} Live</span>
                      </div>
                    )}
                  </div>

                  {/* Card Meta Stats */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Shapes className="w-3.5 h-3.5 text-slate-400" />
                      <span>{board.elementCount} elements</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {board.openCommentCount > 0 ? (
                          <span className="text-amber-600 font-semibold">{board.openCommentCount} open feedback</span>
                        ) : (
                          `${board.commentCount} comments`
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Copy Editor Link */}
                    <button
                      onClick={() => handleCopyLink(board.id, 'editor')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                        copiedBoardId === `${board.id}-editor`
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                      title="Copy Editor Link (can draw and comment)"
                    >
                      {copiedBoardId === `${board.id}-editor` ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-blue-600" />
                          <span>Editor Link</span>
                        </>
                      )}
                    </button>

                    {/* Copy Commenter Link */}
                    <button
                      onClick={() => handleCopyLink(board.id, 'commenter')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                        copiedBoardId === `${board.id}-commenter`
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                      title="Copy Commenter Link (view only + comment pins)"
                    >
                      {copiedBoardId === `${board.id}-commenter` ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                          <span>Commenter Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => navigate(`/board/${board.id}`)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                    title="Open Board"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Board Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-slate-800 relative">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">New Client Whiteboard</h2>
                <p className="text-xs text-slate-500">Create a dedicated space for your client</p>
              </div>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Whiteboard / Client Name
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Client 1 Review, Acme Strategy"
                  value={newBoardName}
                  onChange={(e) => {
                    setNewBoardName(e.target.value);
                    if (!newBoardSlug) {
                      setNewBoardSlug(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-')
                      );
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Custom URL Identifier (Optional)
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-xs text-slate-500 font-mono">
                    /board/
                  </span>
                  <input
                    type="text"
                    placeholder="1clientwhiteboard"
                    value={newBoardSlug}
                    onChange={(e) => setNewBoardSlug(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-r-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Client Auto-Name Prefix (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. HiltonTeam (defaults to [ClientName]Team)"
                  value={newBoardTeamPrefix}
                  onChange={(e) => setNewBoardTeamPrefix(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Users joining automatically get named: {newBoardTeamPrefix || newBoardName || 'Client'} 1, 2, 3... with zero prompts.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Room Passcode (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave empty for open link access"
                  value={newBoardPasscode}
                  onChange={(e) => setNewBoardPasscode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition cursor-pointer"
                >
                  Create & Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
