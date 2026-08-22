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
  Shield,
  Layers,
  ArrowRight,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { fetchBoards, createBoard, adminLogin, adminLogout, verifyAdmin } from '../services/api';
import { BoardSummary, UserRole } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Admin Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Dashboard Boards State
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

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      const valid = await verifyAdmin();
      setIsAuthenticated(valid);
      if (valid) {
        loadBoards();
      } else {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const loadBoards = async () => {
    try {
      setLoading(true);
      const data = await fetchBoards();
      setBoards(data);
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        setIsAuthenticated(false);
      } else {
        console.error('Failed to load boards', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setIsAuthenticating(true);
    setAuthError('');

    try {
      await adminLogin(passwordInput.trim());
      setIsAuthenticated(true);
      setPasswordInput('');
      await loadBoards();
    } catch (err: any) {
      setAuthError(err.message || 'Invalid admin password');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAdminLogout = async () => {
    await adminLogout();
    setIsAuthenticated(false);
    setBoards([]);
  };

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

  // 1. Initial auth check loading spinner
  if (isAuthenticated === null && loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-500">Checking admin session...</span>
        </div>
      </div>
    );
  }

  // 2. Admin Login Gate Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Admin Portal</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Enter the admin password to access and manage your client whiteboards
            </p>
          </div>

          {authError && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Admin Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  required
                  placeholder="Enter admin password..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium text-slate-900 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating || !passwordInput.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In as Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Default password: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">admin123</code> (customizable via <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">ADMIN_PASSWORD</code> env)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Admin Dashboard
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
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">Whiteboard Studio</h1>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <p className="text-xs text-slate-500">Manage client spaces, feedback, and links</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Whiteboard</span>
            </button>

            <button
              onClick={handleAdminLogout}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-red-600 border border-slate-200 transition cursor-pointer"
              title="Lock Admin Panel / Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Search and Stats Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search whiteboards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span>
              Total: <strong className="text-slate-800">{boards.length}</strong> whiteboards
            </span>
          </div>
        </div>

        {/* Boards Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs font-medium">Loading client whiteboards...</span>
          </div>
        ) : filteredBoards.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">No whiteboards found</h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              {searchQuery
                ? 'No client whiteboards match your search query.'
                : 'Create your first dedicated client whiteboard to start collaborating.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Client Whiteboard</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBoards.map((board) => (
              <div
                key={board.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition duration-200 overflow-hidden flex flex-col justify-between group"
              >
                <div className="p-5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3
                        onClick={() => navigate(`/board/${board.id}`)}
                        className="font-bold text-sm text-slate-900 truncate hover:text-blue-600 cursor-pointer transition"
                        title={board.name}
                      >
                        {board.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">/board/{board.id}</p>
                    </div>

                    {board.hasPasscode && (
                      <span
                        className="p-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
                        title="Passcode Protected"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}

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
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium">
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
                  placeholder="e.g. Hilton Hotel, Acme Corp"
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
                    placeholder="hilton-hotel"
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
                  Users joining automatically get named: {newBoardTeamPrefix || newBoardName || 'Client'} 1, 2, 3...
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
