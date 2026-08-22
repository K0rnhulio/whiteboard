import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  Trash2,
  Clock,
  MessageSquarePlus,
} from 'lucide-react';
import { CommentPin, UserRole } from '../types';

interface CommentOverlayProps {
  comments: CommentPin[];
  scrollX: number;
  scrollY: number;
  zoom: number;
  isCommentMode: boolean;
  onExitCommentMode: () => void;
  currentUser: { name: string; color: string; role: UserRole };
  activeCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  onAddComment: (x: number, y: number, text: string) => void;
  onReplyComment: (commentId: string, text: string) => void;
  onResolveComment: (commentId: string, resolved: boolean) => void;
  onDeleteComment: (commentId: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const CommentOverlay: React.FC<CommentOverlayProps> = ({
  comments,
  scrollX,
  scrollY,
  zoom,
  isCommentMode,
  onExitCommentMode,
  currentUser,
  activeCommentId,
  onSelectComment,
  onAddComment,
  onReplyComment,
  onResolveComment,
  onDeleteComment,
  containerRef,
}) => {
  const [newPinPos, setNewPinPos] = useState<{ x: number; y: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const newCommentInputRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  // Focus input when new pin is placed
  useEffect(() => {
    if (newPinPos) {
      setTimeout(() => newCommentInputRef.current?.focus(), 50);
    }
  }, [newPinPos]);

  // Focus reply input when opening existing comment
  useEffect(() => {
    if (activeCommentId) {
      setNewPinPos(null);
      setTimeout(() => replyInputRef.current?.focus(), 50);
    }
  }, [activeCommentId]);

  // Escape key listener to close active popups or cancel comment mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (newPinPos) {
          setNewPinPos(null);
          onExitCommentMode();
        } else if (activeCommentId) {
          onSelectComment(null);
        } else if (isCommentMode) {
          onExitCommentMode();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [newPinPos, activeCommentId, isCommentMode, onExitCommentMode, onSelectComment]);

  // Track mouse down to distinguish between dragging/panning vs clicking
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCommentMode) return;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCommentMode || !dragStartRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const dist = Math.hypot(dx, dy);
    const duration = Date.now() - dragStartRef.current.time;

    dragStartRef.current = null;

    // If mouse moved more than 6px or held longer than 450ms, treat as drag/pan, NOT a pin click
    if (dist > 6 || duration > 450) return;

    // Check if clicked directly on overlay backdrop (not on pins or popups)
    if ((e.target as HTMLElement).id === 'comment-canvas-overlay') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Convert screen coords to scene coords
      const sceneX = screenX / zoom - scrollX;
      const sceneY = screenY / zoom - scrollY;

      setNewPinPos({ x: sceneX, y: sceneY });
      onSelectComment(null);
      // Immediately turn off global drop interception so user can navigate
      onExitCommentMode();
    }
  };

  const handleCreateComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinPos || !newCommentText.trim()) return;

    onAddComment(newPinPos.x, newPinPos.y, newCommentText.trim());
    setNewPinPos(null);
    setNewCommentText('');
    onExitCommentMode();
  };

  const handleCancelNewComment = () => {
    setNewPinPos(null);
    setNewCommentText('');
    onExitCommentMode();
  };

  const handleSendReply = (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    onReplyComment(commentId, replyText.trim());
    setReplyText('');
  };

  // Convert scene coordinates to screen coordinates
  const toScreen = (sceneX: number, sceneY: number) => {
    return {
      x: (sceneX + scrollX) * zoom,
      y: (sceneY + scrollY) * zoom,
    };
  };

  const activeComment = comments.find((c) => c.id === activeCommentId);

  return (
    <div
      id="comment-canvas-overlay"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={`absolute inset-0 pointer-events-none z-20 ${
        isCommentMode ? 'cursor-crosshair pointer-events-auto bg-blue-500/5' : ''
      }`}
    >
      {/* Existing Comment Pins */}
      {comments.map((comment, index) => {
        const pos = toScreen(comment.x, comment.y);
        const isActive = comment.id === activeCommentId;

        // Skip if outside viewport to optimize performance
        if (pos.x < -50 || pos.y < -50 || pos.x > window.innerWidth + 50 || pos.y > window.innerHeight + 50) {
          return null;
        }

        return (
          <div
            key={comment.id}
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-30"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectComment(isActive ? null : comment.id);
                setNewPinPos(null);
              }}
              className={`group flex items-center justify-center rounded-full shadow-lg transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'ring-4 ring-blue-500 ring-offset-2 scale-125 z-40'
                  : 'hover:scale-110 hover:shadow-xl'
              } ${
                comment.resolved
                  ? 'w-7 h-7 bg-slate-100 border border-slate-300 opacity-60 text-slate-500'
                  : 'w-9 h-9 text-white'
              }`}
              style={{
                backgroundColor: comment.resolved ? '#f1f5f9' : comment.authorColor,
              }}
              title={`${comment.author}: ${comment.text}`}
            >
              {comment.resolved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="font-bold text-xs">{index + 1}</span>
              )}
            </button>
          </div>
        );
      })}

      {/* New Pending Pin Placement */}
      {newPinPos && (
        <div
          style={{
            left: `${toScreen(newPinPos.x, newPinPos.y).x}px`,
            top: `${toScreen(newPinPos.x, newPinPos.y).y}px`,
          }}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-40"
        >
          <div
            className="w-9 h-9 rounded-full text-white shadow-xl flex items-center justify-center animate-pulse-pin font-bold text-xs ring-4 ring-white"
            style={{ backgroundColor: currentUser.color }}
          >
            +
          </div>

          {/* New Comment Bubble Form */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-6 top-6 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150 z-50"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full text-[10px] text-white font-bold flex items-center justify-center uppercase"
                  style={{ backgroundColor: currentUser.color }}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-slate-800 truncate">{currentUser.name}</span>
              </div>
              <button
                type="button"
                onClick={handleCancelNewComment}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateComment}>
              <textarea
                ref={newCommentInputRef}
                rows={3}
                placeholder="Leave feedback or comment..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCreateComment(e);
                  }
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none resize-none"
              />

              <div className="flex items-center justify-between mt-2 pt-2">
                <span className="text-[10px] text-slate-400">Press Enter to post</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelNewComment}
                    className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newCommentText.trim()}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Post
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Selected Comment Thread Card */}
      {activeComment && (
        <div
          style={{
            left: `${toScreen(activeComment.x, activeComment.y).x}px`,
            top: `${toScreen(activeComment.x, activeComment.y).y}px`,
          }}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-40"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-6 top-6 w-84 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150 z-50 max-h-96 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center uppercase shrink-0"
                  style={{ backgroundColor: activeComment.authorColor }}
                >
                  {activeComment.author.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {activeComment.author}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{new Date(activeComment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onResolveComment(activeComment.id, !activeComment.resolved)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                    activeComment.resolved
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={activeComment.resolved ? 'Reopen comment' : 'Mark as resolved'}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{activeComment.resolved ? 'Resolved' : 'Resolve'}</span>
                </button>
                <button
                  onClick={() => onDeleteComment(activeComment.id)}
                  className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition cursor-pointer"
                  title="Delete comment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSelectComment(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Comment Body */}
            <div className="overflow-y-auto pr-1 flex-1 space-y-3 mb-3">
              <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                {activeComment.text}
              </p>

              {/* Replies */}
              {activeComment.replies && activeComment.replies.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {activeComment.replies.map((reply) => (
                    <div key={reply.id} className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: reply.authorColor }}
                          />
                          <span className="font-bold text-slate-700">{reply.author}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-600 font-normal whitespace-pre-wrap pl-3.5">
                        {reply.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reply Input Form */}
            <form
              onSubmit={(e) => handleSendReply(e, activeComment.id)}
              className="flex items-center gap-2 pt-2 border-t border-slate-100 shrink-0"
            >
              <input
                ref={replyInputRef}
                type="text"
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl shadow-sm transition cursor-pointer shrink-0"
                title="Send reply"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
