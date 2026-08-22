import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Board, CommentPin, CommentReply } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data');
const BOARDS_DIR = path.join(DATA_DIR, 'boards');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BOARDS_DIR)) {
  fs.mkdirSync(BOARDS_DIR, { recursive: true });
}

// In-memory cache for ultra-fast access
const boardsCache = new Map<string, Board>();
const saveTimeouts = new Map<string, NodeJS.Timeout>();

// Load all boards on server startup
function loadAllFromDisk() {
  try {
    const files = fs.readdirSync(BOARDS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(BOARDS_DIR, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const board: Board = JSON.parse(content);
          if (board && board.id) {
            boardsCache.set(board.id, board);
          }
        } catch (err) {
          console.error(`Failed to parse board file ${file}:`, err);
        }
      }
    }
    console.log(`Loaded ${boardsCache.size} boards from disk.`);
  } catch (err) {
    console.error('Error reading boards directory:', err);
  }
}

loadAllFromDisk();

// Debounced save to disk (prevents disk thrashing during rapid drawing)
function scheduleSave(boardId: string) {
  if (saveTimeouts.has(boardId)) {
    clearTimeout(saveTimeouts.get(boardId)!);
  }

  const timeout = setTimeout(() => {
    saveToDisk(boardId);
    saveTimeouts.delete(boardId);
  }, 1000); // 1-second debounce

  saveTimeouts.set(boardId, timeout);
}

function saveToDisk(boardId: string) {
  const board = boardsCache.get(boardId);
  if (!board) return;

  const filePath = path.join(BOARDS_DIR, `${boardId}.json`);
  const tempPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(board, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Failed to save board ${boardId} to disk:`, err);
  }
}

export function getAllBoardSummaries() {
  const list = [];
  for (const board of boardsCache.values()) {
    list.push({
      id: board.id,
      name: board.name,
      teamPrefix: board.teamPrefix,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      hasPasscode: Boolean(board.passcode && board.passcode.trim().length > 0),
      elementCount: board.elements?.length || 0,
      commentCount: board.comments?.length || 0,
      openCommentCount: board.comments?.filter((c) => !c.resolved)?.length || 0,
    });
  }
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getBoard(id: string): Board | null {
  return boardsCache.get(id) || null;
}

export function getOrCreateBoard(id: string, name?: string, passcode?: string | null, teamPrefix?: string): Board {
  const existing = boardsCache.get(id);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const newBoard: Board = {
    id,
    name: name || id,
    teamPrefix: teamPrefix || undefined,
    createdAt: now,
    updatedAt: now,
    passcode: passcode || null,
    elements: [],
    appState: {
      viewBackgroundColor: '#ffffff',
      theme: 'light',
    },
    files: {},
    comments: [],
  };

  boardsCache.set(id, newBoard);
  saveToDisk(id);
  return newBoard;
}

export function updateBoardMetadata(
  id: string,
  data: { name?: string; passcode?: string | null; teamPrefix?: string }
): Board | null {
  const board = boardsCache.get(id);
  if (!board) return null;

  if (data.name !== undefined) board.name = data.name;
  if (data.passcode !== undefined) board.passcode = data.passcode;
  if (data.teamPrefix !== undefined) board.teamPrefix = data.teamPrefix;
  board.updatedAt = new Date().toISOString();

  boardsCache.set(id, board);
  scheduleSave(id);
  return board;
}

export function updateBoardElements(
  id: string,
  elements: any[],
  appState?: Record<string, any>,
  files?: Record<string, any>
): Board | null {
  const board = boardsCache.get(id);
  if (!board) return null;

  board.elements = elements;
  if (appState) {
    // Keep critical viewport/view properties clean
    board.appState = {
      ...board.appState,
      viewBackgroundColor: appState.viewBackgroundColor || board.appState.viewBackgroundColor,
    };
  }
  if (files) {
    board.files = {
      ...board.files,
      ...files,
    };
  }
  board.updatedAt = new Date().toISOString();

  boardsCache.set(id, board);
  scheduleSave(id);
  return board;
}

export function deleteBoard(id: string): boolean {
  boardsCache.delete(id);
  const filePath = path.join(BOARDS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      console.error(`Failed to delete board file for ${id}:`, err);
    }
  }
  return true;
}

export function verifyBoardPasscode(id: string, passcode?: string | null): boolean {
  const board = boardsCache.get(id);
  if (!board) return true; // new board will be created
  if (!board.passcode || board.passcode.trim() === '') return true;
  return board.passcode === passcode;
}

// Comment operations
export function addCommentPin(boardId: string, comment: CommentPin): CommentPin | null {
  const board = boardsCache.get(boardId);
  if (!board) return null;

  if (!board.comments) board.comments = [];
  board.comments.push(comment);
  board.updatedAt = new Date().toISOString();

  scheduleSave(boardId);
  return comment;
}

export function addCommentReply(
  boardId: string,
  commentId: string,
  reply: CommentReply
): CommentReply | null {
  const board = boardsCache.get(boardId);
  if (!board || !board.comments) return null;

  const comment = board.comments.find((c) => c.id === commentId);
  if (!comment) return null;

  if (!comment.replies) comment.replies = [];
  comment.replies.push(reply);
  board.updatedAt = new Date().toISOString();

  scheduleSave(boardId);
  return reply;
}

export function toggleResolveComment(
  boardId: string,
  commentId: string,
  resolved: boolean,
  resolvedBy?: string
): CommentPin | null {
  const board = boardsCache.get(boardId);
  if (!board || !board.comments) return null;

  const comment = board.comments.find((c) => c.id === commentId);
  if (!comment) return null;

  comment.resolved = resolved;
  comment.resolvedBy = resolved ? resolvedBy : undefined;
  comment.resolvedAt = resolved ? new Date().toISOString() : undefined;
  board.updatedAt = new Date().toISOString();

  scheduleSave(boardId);
  return comment;
}

export function deleteCommentPin(boardId: string, commentId: string): boolean {
  const board = boardsCache.get(boardId);
  if (!board || !board.comments) return false;

  const initialLength = board.comments.length;
  board.comments = board.comments.filter((c) => c.id !== commentId);
  if (board.comments.length !== initialLength) {
    board.updatedAt = new Date().toISOString();
    scheduleSave(boardId);
    return true;
  }
  return false;
}
