import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  getAllBoardSummaries,
  getBoard,
  getOrCreateBoard,
  updateBoardMetadata,
  updateBoardElements,
  deleteBoard,
  verifyBoardPasscode,
  addCommentPin,
  addCommentReply,
  toggleResolveComment,
  deleteCommentPin,
} from './storage.js';
import { CollaboratorUser, CommentPin, CommentReply } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for image data
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Active users tracking: roomId -> (socketId -> CollaboratorUser)
const roomCollaborators = new Map<string, Map<string, CollaboratorUser>>();

function getRoomUsers(roomId: string): CollaboratorUser[] {
  const map = roomCollaborators.get(roomId);
  if (!map) return [];
  return Array.from(map.values());
}

const PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ef4444', // red
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#f97316', // orange
];

function generateAutoGuestName(board: any, existingUsers: CollaboratorUser[]): { name: string; color: string } {
  // If board has explicit teamPrefix, use it (e.g. "HiltonTeam" or "Hilton")
  let prefix = board.teamPrefix?.trim();

  if (!prefix) {
    const raw = board.name || board.id || 'Client';
    // Remove "whiteboard", "board", "roadmap", "review", etc.
    let clean = raw.replace(/\b(whiteboard|board|review|roadmap|strategy|project)\b/gi, '').trim();
    if (!clean) clean = raw.trim();

    if (/hotel/i.test(clean)) {
      // E.g. "HiltonHotel" -> "HiltonTeam", "Hilton Hotel" -> "Hilton Team"
      prefix = clean.replace(/hotel/i, '').trim();
      prefix = clean.includes(' ') ? `${prefix} Team` : `${prefix}Team`;
    } else if (/team/i.test(clean)) {
      prefix = clean;
    } else {
      // E.g. "Hilton" -> "HiltonTeam" if single word without space, else "Hilton Team"
      prefix = clean.includes(' ') ? `${clean} Team` : `${clean}Team`;
    }
  }

  // Check which names are currently in the room
  const usedNames = new Set(existingUsers.map((u) => u.name.toLowerCase()));

  // 1st candidate: prefix (e.g. "HiltonTeam" or "Hilton Team")
  const candidate = prefix.trim();
  if (!usedNames.has(candidate.toLowerCase())) {
    const color = PALETTE[existingUsers.length % PALETTE.length];
    return { name: candidate, color };
  }

  // 2nd candidate and beyond: "HiltonTeam 2" / "HiltonTeam2"
  const spacer = prefix.includes(' ') ? ' ' : '';
  let counter = 2;
  while (usedNames.has(`${prefix.trim()}${spacer}${counter}`.toLowerCase())) {
    counter++;
  }

  const finalName = `${prefix.trim()}${spacer}${counter}`;
  const color = PALETTE[(existingUsers.length + counter - 1) % PALETTE.length];
  return { name: finalName, color };
}

// ---------------- REST API ----------------

// Get list of all boards for Dashboard
app.get('/api/boards', (req, res) => {
  const summaries = getAllBoardSummaries();
  // Attach active viewer count
  const withActiveUsers = summaries.map((b) => ({
    ...b,
    activeUsersCount: getRoomUsers(b.id).length,
  }));
  res.json(withActiveUsers);
});

// Create new board
app.post('/api/boards', (req, res) => {
  const { id: rawId, name, passcode, teamPrefix } = req.body;
  let id = rawId ? rawId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') : '';
  if (!id) {
    id = `board-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  }

  const existing = getBoard(id);
  if (existing) {
    return res.status(409).json({ error: 'A whiteboard with this link already exists.' });
  }

  const board = getOrCreateBoard(id, name || id, passcode || null, teamPrefix || undefined);
  res.status(201).json(board);
});

// Get single board info
app.get('/api/boards/:id', (req, res) => {
  const { id } = req.params;
  const board = getBoard(id);
  if (!board) {
    // If not found, check if we should auto-create or 404
    // We auto-create friendly boards on direct join if they don't exist
    const newBoard = getOrCreateBoard(id);
    return res.json({
      id: newBoard.id,
      name: newBoard.name,
      teamPrefix: newBoard.teamPrefix,
      createdAt: newBoard.createdAt,
      updatedAt: newBoard.updatedAt,
      hasPasscode: false,
      elements: newBoard.elements,
      appState: newBoard.appState,
      files: newBoard.files,
      comments: newBoard.comments,
    });
  }

  res.json({
    id: board.id,
    name: board.name,
    teamPrefix: board.teamPrefix,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    hasPasscode: Boolean(board.passcode && board.passcode.trim().length > 0),
    elements: board.elements,
    appState: board.appState,
    files: board.files,
    comments: board.comments,
  });
});

// Verify passcode
app.post('/api/boards/:id/verify-passcode', (req, res) => {
  const { id } = req.params;
  const { passcode } = req.body;
  const isValid = verifyBoardPasscode(id, passcode);
  if (isValid) {
    res.json({ success: true });
  } else {
    res.status(403).json({ success: false, error: 'Incorrect passcode' });
  }
});

// Update board settings (rename, set passcode, team prefix)
app.patch('/api/boards/:id', (req, res) => {
  const { id } = req.params;
  const { name, passcode, teamPrefix } = req.body;
  const updated = updateBoardMetadata(id, { name, passcode, teamPrefix });
  if (!updated) {
    return res.status(404).json({ error: 'Board not found' });
  }
  // Notify room members of name update
  io.to(`room:${id}`).emit('board_metadata_updated', {
    name: updated.name,
    teamPrefix: updated.teamPrefix,
    hasPasscode: Boolean(updated.passcode && updated.passcode.trim().length > 0),
  });
  res.json(updated);
});

// Delete board
app.delete('/api/boards/:id', (req, res) => {
  const { id } = req.params;
  const deleted = deleteBoard(id);
  if (deleted) {
    io.to(`room:${id}`).emit('board_deleted', { id });
    roomCollaborators.delete(id);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Board not found' });
  }
});

// ---------------- SOCKET.IO REAL-TIME RELAY ----------------

io.on('connection', (socket: Socket) => {
  let currentRoomId: string | null = null;
  let currentUser: CollaboratorUser | null = null;

  // Join Room
  socket.on('join_room', (data: {
    roomId: string;
    userName?: string;
    userColor?: string;
    role?: 'editor' | 'commenter';
    passcode?: string;
  }) => {
    const { roomId, userName, userColor, role = 'editor', passcode } = data;

    // Verify passcode if room has one
    if (!verifyBoardPasscode(roomId, passcode)) {
      socket.emit('room_error', { code: 'INVALID_PASSCODE', message: 'Passcode required or incorrect' });
      return;
    }

    // Leave any prior room
    if (currentRoomId) {
      socket.leave(`room:${currentRoomId}`);
      const map = roomCollaborators.get(currentRoomId);
      if (map) {
        map.delete(socket.id);
        io.to(`room:${currentRoomId}`).emit('collaborators_change', getRoomUsers(currentRoomId));
      }
    }

    currentRoomId = roomId;
    const board = getOrCreateBoard(roomId);
    const existingUsers = getRoomUsers(roomId);

    // Auto-generate team member name if user hasn't provided a custom one
    let finalName = userName?.trim();
    let finalColor = userColor;

    if (!finalName) {
      const autoProfile = generateAutoGuestName(board, existingUsers);
      finalName = autoProfile.name;
      finalColor = autoProfile.color;
    }

    currentUser = {
      socketId: socket.id,
      userId: socket.id,
      name: finalName,
      color: finalColor || '#3b82f6',
      role: role || 'editor',
    };

    if (!roomCollaborators.has(roomId)) {
      roomCollaborators.set(roomId, new Map());
    }
    roomCollaborators.get(roomId)!.set(socket.id, currentUser);

    socket.join(`room:${roomId}`);

    // Send initial snapshot to joining user
    socket.emit('room_joined', {
      board,
      users: getRoomUsers(roomId),
      currentUser,
    });

    // Notify other participants in the room
    socket.to(`room:${roomId}`).emit('user_joined', currentUser);
    io.to(`room:${roomId}`).emit('collaborators_change', getRoomUsers(roomId));
  });

  // Sync canvas elements & files
  socket.on('sync_elements', (data: {
    roomId?: string;
    elements: any[];
    appState?: Record<string, any>;
    files?: Record<string, any>;
  }) => {
    const targetRoom = data.roomId || currentRoomId;
    if (!targetRoom) return;
    if (currentUser && currentUser.role === 'commenter') return; // Commenters cannot modify canvas drawings

    // Persist changes
    updateBoardElements(targetRoom, data.elements, data.appState, data.files);

    // Broadcast instantly to all other clients in this room
    socket.to(`room:${targetRoom}`).emit('elements_synced', {
      elements: data.elements,
      files: data.files,
      senderSocketId: socket.id,
    });
  });

  // Live cursor / pointer movement
  socket.on('cursor_move', (data: {
    pointer: { x: number; y: number; tool?: string };
    button?: string;
    selectedElementIds?: Record<string, boolean>;
  }) => {
    if (!currentRoomId || !currentUser) return;

    currentUser.pointer = data.pointer;
    currentUser.selectedElementIds = data.selectedElementIds;

    socket.to(`room:${currentRoomId}`).emit('cursor_update', {
      socketId: socket.id,
      name: currentUser.name,
      color: currentUser.color,
      pointer: data.pointer,
      button: data.button,
      selectedElementIds: data.selectedElementIds,
    });
  });

  // Update collaborator profile (e.g. changed display name or color)
  socket.on('update_profile', (data: { name?: string; color?: string }) => {
    if (!currentRoomId || !currentUser) return;

    if (data.name) currentUser.name = data.name;
    if (data.color) currentUser.color = data.color;

    io.to(`room:${currentRoomId}`).emit('collaborators_change', getRoomUsers(currentRoomId));
  });

  // Comment pins
  socket.on('add_comment', (data: {
    x: number;
    y: number;
    text: string;
  }) => {
    if (!currentRoomId || !currentUser) return;

    const newComment: CommentPin = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      boardId: currentRoomId,
      x: data.x,
      y: data.y,
      author: currentUser.name,
      authorColor: currentUser.color,
      text: data.text,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    };

    const saved = addCommentPin(currentRoomId, newComment);
    if (saved) {
      io.to(`room:${currentRoomId}`).emit('comment_added', saved);
    }
  });

  socket.on('reply_comment', (data: {
    commentId: string;
    text: string;
  }) => {
    if (!currentRoomId || !currentUser) return;

    const newReply: CommentReply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      author: currentUser.name,
      authorColor: currentUser.color,
      text: data.text,
      createdAt: new Date().toISOString(),
    };

    const saved = addCommentReply(currentRoomId, data.commentId, newReply);
    if (saved) {
      io.to(`room:${currentRoomId}`).emit('comment_replied', {
        commentId: data.commentId,
        reply: saved,
      });
    }
  });

  socket.on('resolve_comment', (data: {
    commentId: string;
    resolved: boolean;
  }) => {
    if (!currentRoomId || !currentUser) return;

    const updated = toggleResolveComment(currentRoomId, data.commentId, data.resolved, currentUser.name);
    if (updated) {
      io.to(`room:${currentRoomId}`).emit('comment_resolved', {
        commentId: data.commentId,
        resolved: data.resolved,
        resolvedBy: currentUser.name,
        resolvedAt: updated.resolvedAt,
      });
    }
  });

  socket.on('delete_comment', (data: { commentId: string }) => {
    if (!currentRoomId) return;

    const deleted = deleteCommentPin(currentRoomId, data.commentId);
    if (deleted) {
      io.to(`room:${currentRoomId}`).emit('comment_deleted', { commentId: data.commentId });
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    if (currentRoomId) {
      const map = roomCollaborators.get(currentRoomId);
      if (map) {
        map.delete(socket.id);
        if (map.size === 0) {
          roomCollaborators.delete(currentRoomId);
        } else {
          io.to(`room:${currentRoomId}`).emit('collaborators_change', getRoomUsers(currentRoomId));
        }
      }
      socket.to(`room:${currentRoomId}`).emit('user_left', { socketId: socket.id });
    }
  });
});

// Serve frontend in production (e.g. on Render)
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Whiteboard Server listening on port ${PORT}`);
});
