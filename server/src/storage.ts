import fs from 'fs';
import path from 'path';
import { Board, CommentPin, CommentReply } from './types.js';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '../data');

const BOARDS_DIR = path.join(DATA_DIR, 'boards');

// Ensure data directory exists
if (!fs.existsSync(BOARDS_DIR)) {
  fs.mkdirSync(BOARDS_DIR, { recursive: true });
}

// In-memory cache for fast sync and low-latency socket emits
const boardsCache = new Map<string, Board>();

// Initial load from disk
export function loadAllFromDisk() {
  try {
    if (!fs.existsSync(BOARDS_DIR)) return;
    const files = fs.readdirSync(BOARDS_DIR);
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(BOARDS_DIR, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const board: Board = JSON.parse(content);
          if (board && board.id) {
            boardsCache.set(board.id.toLowerCase(), board);
            count++;
          }
        } catch (err) {
          console.error(`Failed to parse board file ${file}:`, err);
        }
      }
    }
    console.log(`Loaded ${count} boards from disk.`);
  } catch (err) {
    console.error('Error loading boards from disk:', err);
  }
}

// Debounce timer for disk saves to prevent excessive I/O during heavy multi-user drawing
const saveTimeouts = new Map<string, NodeJS.Timeout>();

function scheduleSave(boardId: string) {
  const normalizedId = boardId.toLowerCase();
  if (saveTimeouts.has(normalizedId)) {
    clearTimeout(saveTimeouts.get(normalizedId)!);
  }

  const timeout = setTimeout(() => {
    saveToDisk(normalizedId);
    saveTimeouts.delete(normalizedId);
  }, 1000); // 1-second debounce

  saveTimeouts.set(normalizedId, timeout);
}

function saveToDisk(boardId: string) {
  const normalizedId = boardId.toLowerCase();
  const board = boardsCache.get(normalizedId);
  if (!board) return;

  const filePath = path.join(BOARDS_DIR, `${normalizedId}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(board, null, 2), 'utf-8');
    console.log(`[Storage] Saved board "${normalizedId}" (${board.elements?.length || 0} elements, ${board.comments?.length || 0} comments) to disk.`);
  } catch (err) {
    console.error(`Failed to save board ${normalizedId} to disk:`, err);
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
      openCommentCount: board.comments?.filter((c: CommentPin) => !c.resolved)?.length || 0,
    });
  }
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getBoard(id: string): Board | null {
  return boardsCache.get(id.toLowerCase()) || null;
}

export function getOrCreateBoard(id: string, name?: string, passcode?: string | null, teamPrefix?: string): Board {
  const normalizedId = id.toLowerCase();
  const existing = boardsCache.get(normalizedId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const newBoard: Board = {
    id: normalizedId,
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

  boardsCache.set(normalizedId, newBoard);
  saveToDisk(normalizedId);
  return newBoard;
}

export function updateBoardMetadata(
  id: string,
  data: { name?: string; passcode?: string | null; teamPrefix?: string }
): Board | null {
  const normalizedId = id.toLowerCase();
  const board = boardsCache.get(normalizedId);
  if (!board) return null;

  if (data.name !== undefined) board.name = data.name;
  if (data.passcode !== undefined) board.passcode = data.passcode;
  if (data.teamPrefix !== undefined) board.teamPrefix = data.teamPrefix;
  board.updatedAt = new Date().toISOString();

  boardsCache.set(normalizedId, board);
  scheduleSave(normalizedId);
  return board;
}

export function updateBoardElements(
  id: string,
  elements: any[],
  appState?: Record<string, any>,
  files?: Record<string, any>
): Board | null {
  const normalizedId = id.toLowerCase();
  const board = boardsCache.get(normalizedId);
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

  boardsCache.set(normalizedId, board);
  scheduleSave(normalizedId);
  return board;
}

export function deleteBoard(id: string): boolean {
  const normalizedId = id.toLowerCase();
  boardsCache.delete(normalizedId);
  const filePath = path.join(BOARDS_DIR, `${normalizedId}.json`);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      console.error(`Failed to delete board file for ${normalizedId}:`, err);
    }
  }
  return true;
}

export function verifyBoardPasscode(id: string, passcode?: string | null): boolean {
  const normalizedId = id.toLowerCase();
  const board = boardsCache.get(normalizedId);
  if (!board) return true; // new board will be created
  if (!board.passcode || board.passcode.trim() === '') return true;
  return board.passcode === passcode;
}

// Comment operations
export function addCommentPin(boardId: string, comment: CommentPin): CommentPin | null {
  const normalizedId = boardId.toLowerCase();
  let board = boardsCache.get(normalizedId);
  if (!board) {
    board = getOrCreateBoard(normalizedId);
  }

  if (!board.comments) board.comments = [];
  
  // Prevent duplicate comment IDs
  const existsIndex = board.comments.findIndex((c: CommentPin) => c.id === comment.id);
  if (existsIndex >= 0) {
    board.comments[existsIndex] = comment;
  } else {
    board.comments.push(comment);
  }
  
  board.updatedAt = new Date().toISOString();

  boardsCache.set(normalizedId, board);
  scheduleSave(normalizedId);
  return comment;
}

export function addCommentReply(
  boardId: string,
  commentId: string,
  reply: CommentReply
): CommentReply | null {
  const normalizedId = boardId.toLowerCase();
  const board = boardsCache.get(normalizedId);
  if (!board || !board.comments) return null;

  const comment = board.comments.find((c: CommentPin) => c.id === commentId);
  if (!comment) return null;

  if (!comment.replies) comment.replies = [];
  comment.replies.push(reply);
  board.updatedAt = new Date().toISOString();

  scheduleSave(normalizedId);
  return reply;
}

export function toggleResolveComment(
  boardId: string,
  commentId: string,
  resolved: boolean,
  resolvedBy?: string
): CommentPin | null {
  const normalizedId = boardId.toLowerCase();
  const board = boardsCache.get(normalizedId);
  if (!board || !board.comments) return null;

  const comment = board.comments.find((c: CommentPin) => c.id === commentId);
  if (!comment) return null;

  comment.resolved = resolved;
  comment.resolvedBy = resolved ? resolvedBy : undefined;
  comment.resolvedAt = resolved ? new Date().toISOString() : undefined;
  board.updatedAt = new Date().toISOString();

  scheduleSave(normalizedId);
  return comment;
}

export function deleteCommentPin(boardId: string, commentId: string): boolean {
  const normalizedId = boardId.toLowerCase();
  const board = boardsCache.get(normalizedId);
  if (!board || !board.comments) return false;

  const initialLength = board.comments.length;
  board.comments = board.comments.filter((c: CommentPin) => c.id !== commentId);
  if (board.comments.length !== initialLength) {
    board.updatedAt = new Date().toISOString();
    scheduleSave(normalizedId);
    return true;
  }
  return false;
}
