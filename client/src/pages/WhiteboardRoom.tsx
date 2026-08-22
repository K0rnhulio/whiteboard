import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  Share2,
  Settings,
  MessageSquare,
  ArrowLeft,
  Lock,
  Download,
  Eye,
  Edit3,
  MousePointer,
} from 'lucide-react';
import { getSocket } from '../services/socket';
import { fetchBoard, verifyPasscode } from '../services/api';
import { CollaboratorsList } from '../components/CollaboratorsList';
import { CommentOverlay } from '../components/CommentOverlay';
import { CommentsSidebar } from '../components/CommentsSidebar';
import { ShareModal } from '../components/ShareModal';
import { PasscodeModal } from '../components/PasscodeModal';
import { NamePromptModal } from '../components/NamePromptModal';
import { BoardSettingsModal } from '../components/BoardSettingsModal';
import { BoardData, CollaboratorUser, CommentPin, UserRole } from '../types';

export const WhiteboardRoom: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const boardId = slug || 'default';
  const roleFromUrl = (searchParams.get('role') as UserRole) || 'editor';

  const [excalidrawAPI, setExcalidrawAPIState] = useState<any>(null);
  const excalidrawAPIRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pendingInitialDataRef = useRef<any>(null);
  const isInitialDataLoadedRef = useRef(false);

  // Stable API setter
  const handleSetExcalidrawAPI = useCallback((api: any) => {
    if (excalidrawAPIRef.current !== api) {
      excalidrawAPIRef.current = api;
      setExcalidrawAPIState(api);

      // If board data arrived before API was ready, load it immediately onto canvas
      if (pendingInitialDataRef.current && api) {
        const board = pendingInitialDataRef.current;
        try {
          isUpdatingFromSocketRef.current = true;
          api.updateScene({
            elements: board.elements || [],
            appState: board.appState,
            commitToHistory: false,
          });
          if (board.files && Object.keys(board.files).length > 0) {
            api.addFiles(Object.values(board.files));
          }
          lastSyncElementsRef.current = JSON.stringify(board.elements || []);
          isInitialDataLoadedRef.current = true;
        } catch (err) {
          console.warn('Initial API scene update error:', err);
        } finally {
          setTimeout(() => {
            isUpdatingFromSocketRef.current = false;
          }, 150);
        }
      }
    }
  }, []);

  // User Profile
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('wb_user_name') || '';
  });
  const [userColor, setUserColor] = useState<string>(() => {
    return localStorage.getItem('wb_user_color') || '#3b82f6';
  });
  const [userRole, setUserRole] = useState<UserRole>(roleFromUrl);
  const userRoleRef = useRef<UserRole>(userRole);
  userRoleRef.current = userRole;

  // Modals state
  const [isNamePromptOpen, setIsNamePromptOpen] = useState(false);
  const [isPasscodeRequired, setIsPasscodeRequired] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCommentsSidebarOpen, setIsCommentsSidebarOpen] = useState(false);

  // Board Data & Sync state
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorUser[]>([]);
  const [currentSocketId, setCurrentSocketId] = useState<string>('');
  const [comments, setComments] = useState<CommentPin[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const activeCommentIdRef = useRef<string | null>(activeCommentId);
  activeCommentIdRef.current = activeCommentId;

  const [isCommentMode, setIsCommentMode] = useState(false);

  // Remote pointers state: socketId -> { name, color, pointer: { x, y } }
  const [remotePointers, setRemotePointers] = useState<
    Record<string, { name: string; color: string; pointer: { x: number; y: number } }>
  >({});

  // Viewport tracking for overlay coordinate alignment
  const [viewport, setViewport] = useState({
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
  });
  const prevViewportRef = useRef({ scrollX: 0, scrollY: 0, zoom: 1 });

  const lastSyncElementsRef = useRef<string>('');
  const lastFilesCountRef = useRef<number>(0);
  const isUpdatingFromSocketRef = useRef(false);
  const socket = getSocket();

  // 1. Initial Load: check if board exists & if passcode needed
  useEffect(() => {
    async function init() {
      try {
        const board = await fetchBoard(boardId);
        setBoardData(board);
        setComments(board.comments || []);
        pendingInitialDataRef.current = board;
        isInitialDataLoadedRef.current = true;

        // If API is already ready, load scene immediately
        const api = excalidrawAPIRef.current;
        if (api && board) {
          try {
            isUpdatingFromSocketRef.current = true;
            api.updateScene({
              elements: board.elements || [],
              appState: board.appState,
              commitToHistory: false,
            });
            if (board.files && Object.keys(board.files).length > 0) {
              api.addFiles(Object.values(board.files));
            }
            lastSyncElementsRef.current = JSON.stringify(board.elements || []);
          } catch (err) {
            console.warn('FetchBoard scene load error:', err);
          } finally {
            setTimeout(() => {
              isUpdatingFromSocketRef.current = false;
            }, 150);
          }
        }

        if (board.hasPasscode) {
          setIsPasscodeRequired(true);
        } else {
          joinRoom(userName, userColor, userRoleRef.current);
        }
      } catch (err) {
        console.error('Failed to load board', err);
        isInitialDataLoadedRef.current = true;
        joinRoom(userName, userColor, userRoleRef.current);
      }
    }

    init();
  }, [boardId]);

  const handlePasscodeSuccess = () => {
    setIsPasscodeRequired(false);
    joinRoom(userName, userColor, userRoleRef.current);
  };

  // 2. Connect & Join Room via Socket
  const joinRoom = useCallback(
    (name: string, color: string, role: UserRole) => {
      if (!socket.connected) {
        socket.connect();
      }

      socket.emit('join_room', {
        roomId: boardId,
        userName: name || undefined,
        userColor: color || undefined,
        role,
      });
    },
    [boardId, socket]
  );

  // 3. Socket Listeners setup (runs once per boardId)
  useEffect(() => {
    socket.on('connect', () => {
      setCurrentSocketId(socket.id || '');
      // Ensure user joins room on connection / reconnection
      joinRoom(userName, userColor, userRoleRef.current);
    });

    socket.on('room_joined', (data: { board: BoardData; users: CollaboratorUser[]; currentUser: CollaboratorUser }) => {
      setBoardData(data.board);
      setCollaborators(data.users || []);
      setComments(data.board?.comments || []);
      if (data.currentUser) {
        setCurrentSocketId(data.currentUser.socketId);
        setUserName(data.currentUser.name);
        setUserColor(data.currentUser.color);
      }

      pendingInitialDataRef.current = data.board;
      isInitialDataLoadedRef.current = true;

      // Load initial elements onto Excalidraw
      const api = excalidrawAPIRef.current;
      if (api && data.board) {
        try {
          isUpdatingFromSocketRef.current = true;
          api.updateScene({
            elements: data.board.elements || [],
            appState: data.board.appState,
            commitToHistory: false,
          });
          if (data.board.files && Object.keys(data.board.files).length > 0) {
            api.addFiles(Object.values(data.board.files));
          }
          lastSyncElementsRef.current = JSON.stringify(data.board.elements || []);
        } catch (err) {
          console.warn('Initial scene load error:', err);
        } finally {
          setTimeout(() => {
            isUpdatingFromSocketRef.current = false;
          }, 150);
        }
      }
    });

    socket.on('collaborators_change', (users: CollaboratorUser[]) => {
      setCollaborators(users || []);
    });

    socket.on('elements_synced', (data: { elements: any[]; files?: Record<string, any>; senderSocketId: string }) => {
      const api = excalidrawAPIRef.current;
      if (api) {
        try {
          isUpdatingFromSocketRef.current = true;
          api.updateScene({
            elements: data.elements || [],
            commitToHistory: false,
          });
          if (data.files && Object.keys(data.files).length > 0) {
            api.addFiles(Object.values(data.files));
          }
          lastSyncElementsRef.current = JSON.stringify(data.elements || []);
        } catch (err) {
          console.warn('Sync update error:', err);
        } finally {
          setTimeout(() => {
            isUpdatingFromSocketRef.current = false;
          }, 80);
        }
      }
    });

    socket.on('cursor_update', (data: { socketId: string; name: string; color: string; pointer: { x: number; y: number } }) => {
      setRemotePointers((prev) => ({
        ...prev,
        [data.socketId]: {
          name: data.name,
          color: data.color,
          pointer: data.pointer,
        },
      }));
    });

    socket.on('user_left', (data: { socketId: string }) => {
      setRemotePointers((prev) => {
        const next = { ...prev };
        delete next[data.socketId];
        return next;
      });
    });

    socket.on('board_metadata_updated', (data: { name: string; hasPasscode: boolean }) => {
      setBoardData((prev) => (prev ? { ...prev, name: data.name, hasPasscode: data.hasPasscode } : null));
    });

    socket.on('board_deleted', () => {
      alert('This whiteboard was deleted by the owner.');
      navigate('/');
    });

    // Comments real-time events
    socket.on('comment_added', (comment: CommentPin) => {
      setComments((prev) => {
        const existsIndex = prev.findIndex((c) => c.id === comment.id);
        if (existsIndex >= 0) {
          const updated = [...prev];
          updated[existsIndex] = comment;
          return updated;
        }
        return [...prev, comment];
      });
      setActiveCommentId(comment.id);
    });

    socket.on('comment_replied', (data: { commentId: string; reply: any }) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === data.commentId
            ? { ...c, replies: [...(c.replies || []), data.reply] }
            : c
        )
      );
    });

    socket.on('comment_resolved', (data: { commentId: string; resolved: boolean; resolvedBy?: string; resolvedAt?: string }) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === data.commentId
            ? {
                ...c,
                resolved: data.resolved,
                resolvedBy: data.resolvedBy,
                resolvedAt: data.resolvedAt,
              }
            : c
        )
      );
    });

    socket.on('comment_deleted', (data: { commentId: string }) => {
      setComments((prev) => prev.filter((c) => c.id !== data.commentId));
      if (activeCommentIdRef.current === data.commentId) {
        setActiveCommentId(null);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('room_joined');
      socket.off('collaborators_change');
      socket.off('elements_synced');
      socket.off('cursor_update');
      socket.off('user_left');
      socket.off('board_metadata_updated');
      socket.off('board_deleted');
      socket.off('comment_added');
      socket.off('comment_replied');
      socket.off('comment_resolved');
      socket.off('comment_deleted');
    };
  }, [socket, navigate]);

  // Load initial elements once API is ready if boardData arrived first
  useEffect(() => {
    if (excalidrawAPI && boardData?.elements && boardData.elements.length > 0) {
      try {
        isUpdatingFromSocketRef.current = true;
        excalidrawAPI.updateScene({
          elements: boardData.elements,
          appState: boardData.appState,
          commitToHistory: false,
        });
        if (boardData.files && Object.keys(boardData.files).length > 0) {
          excalidrawAPI.addFiles(Object.values(boardData.files));
        }
        lastSyncElementsRef.current = JSON.stringify(boardData.elements);
      } catch (err) {
        console.warn('Initial API updateScene error:', err);
      } finally {
        setTimeout(() => {
          isUpdatingFromSocketRef.current = false;
        }, 100);
      }
    }
  }, [excalidrawAPI]); // Only runs when excalidrawAPI instance changes (once)

  // Excalidraw Change Handler (strictly guarded against infinite loops)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleExcalidrawChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      const scrollX = appState.scrollX || 0;
      const scrollY = appState.scrollY || 0;
      const zoom = appState.zoom?.value || 1;

      // Only update viewport state if changed significantly (prevents render loops!)
      if (
        Math.abs(prevViewportRef.current.scrollX - scrollX) > 0.5 ||
        Math.abs(prevViewportRef.current.scrollY - scrollY) > 0.5 ||
        Math.abs(prevViewportRef.current.zoom - zoom) > 0.001
      ) {
        prevViewportRef.current = { scrollX, scrollY, zoom };
        setViewport({ scrollX, scrollY, zoom });
      }

      if (!isInitialDataLoadedRef.current) return; // Do not broadcast until initial board scene has loaded
      if (isUpdatingFromSocketRef.current) return;
      if (userRoleRef.current === 'commenter') return; // Commenters cannot edit elements

      const serialized = JSON.stringify(elements);
      if (serialized === lastSyncElementsRef.current) return;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      const filesCount = files ? Object.keys(files).length : 0;
      const filesChanged = filesCount !== lastFilesCountRef.current;
      if (filesChanged) {
        lastFilesCountRef.current = filesCount;
      }

      syncTimeoutRef.current = setTimeout(() => {
        lastSyncElementsRef.current = serialized;
        socket.emit('sync_elements', {
          roomId: boardId,
          elements: Array.from(elements),
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
          },
          // Only send files payload when images are actually added/changed to save bandwidth
          ...(filesChanged ? { files } : {}),
        });
      }, 100); // 100ms debounce for high snappiness
    },
    [socket, boardId]
  );

  // Multiplayer cursor pointer handler (throttled to ~30fps for ultra-smooth rendering with low network overhead)
  const lastPointerEmitRef = useRef<number>(0);

  const handlePointerUpdate = useCallback(
    (payload: {
      pointer: { x: number; y: number; tool: 'pointer' | 'laser' };
      button: 'down' | 'up';
      pointersMap: Map<number, Readonly<{ x: number; y: number }>>;
    }) => {
      const now = Date.now();
      if (now - lastPointerEmitRef.current > 33) {
        lastPointerEmitRef.current = now;
        socket.emit('cursor_move', {
          pointer: payload.pointer,
          button: payload.button,
        });
      }
    },
    [socket]
  );

  // Export board as PNG
  const handleExportPNG = async () => {
    if (!excalidrawAPI) return;
    try {
      const elements = excalidrawAPI.getSceneElements();
      if (!elements || elements.length === 0) {
        alert('Canvas is empty. Draw or paste something first!');
        return;
      }
      const blob = await exportToBlob({
        elements,
        mimeType: 'image/png',
        appState: {
          exportBackground: true,
          viewBackgroundColor: '#ffffff',
        },
        files: excalidrawAPI.getFiles(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${boardData?.name || 'whiteboard'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Comment Handlers with Optimistic Updates & Explicit Metadata
  const handleAddComment = (x: number, y: number, text: string) => {
    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const authorName = userName || 'Guest';
    const authorColor = userColor || '#3b82f6';

    const optimisticComment: CommentPin = {
      id: commentId,
      boardId,
      x,
      y,
      author: authorName,
      authorColor: authorColor,
      text,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    };

    // Immediate optimistic placement in local state
    setComments((prev) => {
      if (prev.some((c) => c.id === commentId)) return prev;
      return [...prev, optimisticComment];
    });
    setActiveCommentId(commentId);

    // Relay to socket server with complete metadata
    socket.emit('add_comment', {
      roomId: boardId,
      commentId,
      x,
      y,
      text,
      author: authorName,
      authorColor: authorColor,
    });
  };

  const handleReplyComment = (commentId: string, text: string) => {
    const authorName = userName || 'Guest';
    const authorColor = userColor || '#3b82f6';

    const optimisticReply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      author: authorName,
      authorColor: authorColor,
      text,
      createdAt: new Date().toISOString(),
    };

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, replies: [...(c.replies || []), optimisticReply] }
          : c
      )
    );

    socket.emit('reply_comment', {
      roomId: boardId,
      commentId,
      text,
      author: authorName,
      authorColor: authorColor,
    });
  };

  const handleResolveComment = (commentId: string, resolved: boolean) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              resolved,
              resolvedBy: resolved ? (userName || 'Guest') : undefined,
              resolvedAt: resolved ? new Date().toISOString() : undefined,
            }
          : c
      )
    );

    socket.emit('resolve_comment', { roomId: boardId, commentId, resolved });
  };

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    if (activeCommentIdRef.current === commentId) {
      setActiveCommentId(null);
    }
    socket.emit('delete_comment', { roomId: boardId, commentId });
  };

  const handleUpdateProfile = (name: string, color: string) => {
    setUserName(name);
    setUserColor(color);
    localStorage.setItem('wb_user_name', name);
    localStorage.setItem('wb_user_color', color);
    socket.emit('update_profile', { name, color });
  };

  // Remote cursor screen projection helper
  const getPointerScreenPos = (sceneX: number, sceneY: number) => {
    return {
      x: (sceneX + viewport.scrollX) * viewport.zoom,
      y: (sceneY + viewport.scrollY) * viewport.zoom,
    };
  };

  // Memoize UI options so Excalidraw never sees a new object reference
  const uiOptions = useMemo(
    () => ({
      canvasActions: {
        changeViewBackgroundColor: true,
        clearCanvas: userRole === 'editor',
        loadScene: false,
        saveToActiveFile: false,
        toggleTheme: true,
        saveAsImage: true,
      },
    }),
    [userRole]
  );

  const initialData = useMemo(() => {
    if (!boardData) return undefined;
    return {
      elements: boardData.elements || [],
      appState: {
        viewBackgroundColor: boardData.appState?.viewBackgroundColor || '#ffffff',
        ...boardData.appState,
      },
      files: boardData.files || {},
    };
  }, [boardData?.id]);

  if (!boardData) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold">Loading Whiteboard...</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden select-none">
      {/* Top Application Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition cursor-pointer"
            title="Back to All Whiteboards"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-sm sm:text-base text-slate-900 truncate max-w-[200px] sm:max-w-xs">
              {boardData.name || boardId}
            </h2>

            {boardData?.hasPasscode && (
              <span className="p-1 rounded bg-amber-50 text-amber-700 text-xs" title="Passcode Protected">
                <Lock className="w-3.5 h-3.5" />
              </span>
            )}

            {/* Role indicator badge */}
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                userRole === 'editor'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-purple-50 text-purple-700 border border-purple-200'
              }`}
            >
              {userRole === 'editor' ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{userRole === 'editor' ? 'Editor' : 'Commenter'}</span>
            </span>
          </div>
        </div>

        {/* Right Tools Bar */}
        <div className="flex items-center gap-2">
          {/* Add Comment Pin Button */}
          <button
            onClick={() => {
              setIsCommentMode(!isCommentMode);
              setActiveCommentId(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              isCommentMode
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-500/30'
                : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'
            }`}
            title="Click to drop a comment pin anywhere on the board (Shortcut: C)"
          >
            <MessageSquare className={`w-3.5 h-3.5 ${isCommentMode ? 'text-white' : 'text-blue-600'}`} />
            <span>{isCommentMode ? 'Cancel Comment' : 'Add Comment'}</span>
            {comments.filter((c) => !c.resolved).length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isCommentMode ? 'bg-blue-800 text-white' : 'bg-blue-50 text-blue-700'
              }`}>
                {comments.filter((c) => !c.resolved).length}
              </span>
            )}
          </button>

          {/* Comments Sidebar Trigger */}
          <button
            onClick={() => setIsCommentsSidebarOpen(!isCommentsSidebarOpen)}
            className={`p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer relative ${
              isCommentsSidebarOpen ? 'bg-slate-100 text-blue-600' : 'bg-white'
            }`}
            title="Toggle Comments Panel"
          >
            <MessageSquare className="w-4 h-4" />
            {comments.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                {comments.length}
              </span>
            )}
          </button>

          {/* Active Collaborators */}
          <CollaboratorsList
            collaborators={collaborators}
            currentSocketId={currentSocketId}
            onUpdateProfile={handleUpdateProfile}
          />

          {/* Export PNG */}
          <button
            onClick={handleExportPNG}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
            title="Download PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          {/* Share Button */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Link</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 bg-white transition cursor-pointer"
            title="Board Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative w-full h-[calc(100vh-3.5rem)] excalidraw-container"
        style={{ height: 'calc(100vh - 3.5rem)', width: '100vw' }}
      >
        {/* Comment Mode Instruction Banner */}
        {isCommentMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 text-white pl-4 pr-3 py-1.5 rounded-full text-xs font-semibold shadow-xl backdrop-blur flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>Click anywhere to drop comment pin</span>
            </div>
            <button
              onClick={() => setIsCommentMode(false)}
              className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded-full text-[10px] text-slate-200 cursor-pointer"
            >
              Cancel (Esc)
            </button>
          </div>
        )}

        {/* Excalidraw Component */}
        <Excalidraw
          initialData={initialData}
          excalidrawAPI={handleSetExcalidrawAPI}
          onChange={handleExcalidrawChange}
          onPointerUpdate={handlePointerUpdate}
          viewModeEnabled={userRole === 'commenter'}
          zenModeEnabled={false}
          gridModeEnabled={false}
          UIOptions={uiOptions}
        />

        {/* Remote Collaborators Cursors */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {Object.entries(remotePointers).map(([socketId, data]) => {
            if (socketId === currentSocketId || !data.pointer) return null;
            const screen = getPointerScreenPos(data.pointer.x, data.pointer.y);

            return (
              <div
                key={socketId}
                style={{
                  left: `${screen.x}px`,
                  top: `${screen.y}px`,
                  transition: 'left 0.08s ease-out, top 0.08s ease-out',
                }}
                className="absolute transform -translate-x-1 -translate-y-1"
              >
                {/* Pointer Arrow */}
                <svg
                  className="w-5 h-5 drop-shadow-md"
                  viewBox="0 0 24 24"
                  fill={data.color}
                  stroke="white"
                  strokeWidth="1.5"
                >
                  <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35z" />
                </svg>

                {/* Name Tag */}
                <div
                  style={{ backgroundColor: data.color }}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-md whitespace-nowrap -mt-1 ml-4"
                >
                  {data.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pinpoint Comment Overlay */}
        <CommentOverlay
          comments={comments}
          scrollX={viewport.scrollX}
          scrollY={viewport.scrollY}
          zoom={viewport.zoom}
          isCommentMode={isCommentMode}
          onExitCommentMode={() => setIsCommentMode(false)}
          currentUser={{ name: userName, color: userColor, role: userRole }}
          activeCommentId={activeCommentId}
          onSelectComment={(id) => setActiveCommentId(id)}
          onAddComment={handleAddComment}
          onReplyComment={handleReplyComment}
          onResolveComment={handleResolveComment}
          onDeleteComment={handleDeleteComment}
          containerRef={containerRef}
        />

        {/* Comments Sidebar Panel */}
        <CommentsSidebar
          isOpen={isCommentsSidebarOpen}
          onClose={() => setIsCommentsSidebarOpen(false)}
          comments={comments}
          activeCommentId={activeCommentId}
          onSelectComment={(id) => {
            setActiveCommentId(id);
            const comment = comments.find((c) => c.id === id);
            if (comment && excalidrawAPI) {
              // Center viewport on comment
              excalidrawAPI.scrollToContent(undefined, {
                animate: true,
                duration: 300,
              });
            }
          }}
          onReplyComment={handleReplyComment}
          onResolveComment={handleResolveComment}
          onDeleteComment={handleDeleteComment}
        />
      </div>

      {/* Passcode Unlock Modal */}
      <PasscodeModal
        isOpen={isPasscodeRequired}
        boardName={boardData?.name || boardId}
        onVerify={(passcode) => verifyPasscode(boardId, passcode)}
        onSuccess={handlePasscodeSuccess}
      />

      {/* Share Link Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        boardId={boardId}
        boardName={boardData?.name || boardId}
        hasPasscode={Boolean(boardData?.hasPasscode)}
      />

      {/* Board Settings Modal */}
      <BoardSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        boardId={boardId}
        currentName={boardData?.name || boardId}
        currentTeamPrefix={boardData?.teamPrefix}
        hasPasscode={Boolean(boardData?.hasPasscode)}
        onUpdated={(newName, hasPass, teamPfx) => {
          setBoardData((prev) => (prev ? { ...prev, name: newName, hasPasscode: hasPass, teamPrefix: teamPfx } : null));
        }}
        onDeleted={() => navigate('/')}
      />
    </div>
  );
};
