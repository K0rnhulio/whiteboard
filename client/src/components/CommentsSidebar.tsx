import React, { useState } from 'react';
import {
  MessageSquare,
  X,
  CheckCircle2,
  Trash2,
  Send,
  Filter,
  Check,
  RotateCcw,
  MapPin,
  Clock,
} from 'lucide-react';
import { CommentPin } from '../types';

interface CommentsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  comments: CommentPin[];
  activeCommentId: string | null;
  onSelectComment: (id: string) => void;
  onReplyComment: (commentId: string, text: string) => void;
  onResolveComment: (commentId: string, resolved: boolean) => void;
  onDeleteComment: (commentId: string) => void;
}

export const CommentsSidebar: React.FC<CommentsSidebarProps> = ({
  isOpen,
  onClose,
  comments,
  activeCommentId,
  onSelectComment,
  onReplyComment,
  onResolveComment,
  onDeleteComment,
}) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const filteredComments = comments.filter((c) => {
    if (filter === 'open') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    return true;
  });

  const handleSendReply = (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    const text = replyTexts[commentId];
    if (!text || !text.trim()) return;

    onReplyComment(commentId, text.trim());
    setReplyTexts((prev) => ({ ...prev, [commentId]: '' }));
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 md:w-96 bg-white shadow-2xl border-l border-slate-200 z-40 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-sm text-slate-800">
            Comments & Feedback ({comments.length})
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex p-2 bg-slate-50 border-b border-slate-100 gap-1 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition cursor-pointer ${
            filter === 'all'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          All ({comments.length})
        </button>
        <button
          onClick={() => setFilter('open')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition cursor-pointer ${
            filter === 'open'
              ? 'bg-white shadow-sm text-amber-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Open ({comments.filter((c) => !c.resolved).length})
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition cursor-pointer ${
            filter === 'resolved'
              ? 'bg-white shadow-sm text-emerald-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Resolved ({comments.filter((c) => c.resolved).length})
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredComments.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No comments yet</p>
            <p className="text-xs mt-1 text-slate-400">
              Switch to Comment Mode to drop feedback pins on the canvas.
            </p>
          </div>
        ) : (
          filteredComments.map((comment, index) => {
            const isSelected = comment.id === activeCommentId;
            return (
              <div
                key={comment.id}
                onClick={() => onSelectComment(comment.id)}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/10'
                    : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm'
                }`}
              >
                {/* Author & Actions */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center uppercase shrink-0"
                      style={{ backgroundColor: comment.authorColor }}
                    >
                      {comment.author.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{comment.author}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onResolveComment(comment.id, !comment.resolved)}
                      className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        comment.resolved
                          ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100'
                      }`}
                      title={comment.resolved ? 'Reopen comment' : 'Mark as resolved'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteComment(comment.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Delete comment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap mb-3 leading-relaxed">
                  {comment.text}
                </p>

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="space-y-2 mb-3 pl-3 border-l-2 border-slate-200">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="text-xs bg-slate-50 p-2 rounded-xl">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-slate-700">{reply.author}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-600 whitespace-pre-wrap">{reply.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Reply Form */}
                <form
                  onSubmit={(e) => handleSendReply(e, comment.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 pt-2 border-t border-slate-100"
                >
                  <input
                    type="text"
                    placeholder="Reply..."
                    value={replyTexts[comment.id] || ''}
                    onChange={(e) =>
                      setReplyTexts((prev) => ({ ...prev, [comment.id]: e.target.value }))
                    }
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!replyTexts[comment.id]?.trim()}
                    className="p-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
