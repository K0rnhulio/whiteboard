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

// ---------------- ADMIN AUTHENTICATION ----------------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const adminTokens = new Set<string>();

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Admin login required' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }

  const token = `adm_${uuidv4().replace(/-/g, '')}`;
  adminTokens.add(token);
  res.json({ success: true, token });
});

app.get('/api/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (token && adminTokens.has(token)) {
    return res.json({ authenticated: true });
  }
  res.status(401).json({ authenticated: false });
});

app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (token) {
    adminTokens.delete(token);
  }
  res.json({ success: true });
});

// ---------------- HEALTH CHECK ----------------
app.get(['/api/health', '/health'], (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// ---------------- REST API ----------------

// Get list of all boards for Dashboard (Admin only, handles healthchecks)
app.get('/api/boards', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isHealthCheck =
    userAgent.includes('health') ||
    userAgent.includes('railway') ||
    userAgent.includes('render') ||
    Boolean(req.headers['x-railway-healthcheck']);

  if (isHealthCheck) {
    return res.status(200).json({ status: 'healthy' });
  }

  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Admin login required' });
  }

  const summaries = getAllBoardSummaries();
  const withActiveUsers = summaries.map((b) => ({
    ...b,
    activeUsersCount: getRoomUsers(b.id).length,
  }));
  res.json(withActiveUsers);
});

// Create new board (Admin only)
app.post('/api/boards', requireAdmin, (req, res) => {
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

// Delete board (Admin only)
app.delete('/api/boards/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id);
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
    roomId?: string;
    commentId?: string;
    x: number;
    y: number;
    text: string;
    author?: string;
    authorColor?: string;
  }) => {
    const targetRoomId = data.roomId || currentRoomId;
    if (!targetRoomId) return;

    const authorName = currentUser?.name || data.author || 'Guest';
    const authorColor = currentUser?.color || data.authorColor || '#3b82f6';

    const newComment: CommentPin = {
      id: data.commentId || `comment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      boardId: targetRoomId,
      x: data.x,
      y: data.y,
      author: authorName,
      authorColor: authorColor,
      text: data.text,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    };

    const saved = addCommentPin(targetRoomId, newComment);
    if (saved) {
      io.to(`room:${targetRoomId}`).emit('comment_added', saved);
    }
  });

  socket.on('reply_comment', (data: {
    roomId?: string;
    commentId: string;
    text: string;
    author?: string;
    authorColor?: string;
  }) => {
    const targetRoomId = data.roomId || currentRoomId;
    if (!targetRoomId) return;

    const authorName = currentUser?.name || data.author || 'Guest';
    const authorColor = currentUser?.color || data.authorColor || '#3b82f6';

    const newReply: CommentReply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      author: authorName,
      authorColor: authorColor,
      text: data.text,
      createdAt: new Date().toISOString(),
    };

    const saved = addCommentReply(targetRoomId, data.commentId, newReply);
    if (saved) {
      io.to(`room:${targetRoomId}`).emit('comment_replied', {
        commentId: data.commentId,
        reply: saved,
      });
    }
  });

  socket.on('resolve_comment', (data: {
    roomId?: string;
    commentId: string;
    resolved: boolean;
  }) => {
    const targetRoomId = data.roomId || currentRoomId;
    if (!targetRoomId) return;

    const resolverName = currentUser?.name || 'Guest';
    const updated = toggleResolveComment(targetRoomId, data.commentId, data.resolved, resolverName);
    if (updated) {
      io.to(`room:${targetRoomId}`).emit('comment_resolved', {
        commentId: data.commentId,
        resolved: data.resolved,
        resolvedBy: resolverName,
        resolvedAt: updated.resolvedAt,
      });
    }
  });

  socket.on('delete_comment', (data: { roomId?: string; commentId: string }) => {
    const targetRoomId = data.roomId || currentRoomId;
    if (!targetRoomId) return;

    const deleted = deleteCommentPin(targetRoomId, data.commentId);
    if (deleted) {
      io.to(`room:${targetRoomId}`).emit('comment_deleted', { commentId: data.commentId });
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

// Serve frontend with dynamic OpenGraph & Twitter Card metadata for WhatsApp, Zalo, Facebook crawlers
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
const INDEX_HTML_PATH = path.join(CLIENT_DIST, 'index.html');

if (fs.existsSync(CLIENT_DIST)) {
  // Serve static assets (images, js, css) without intercepting root index.html
  app.use(express.static(CLIENT_DIST, { index: false }));

  // Dynamic OpenGraph injection for root and board pages
  app.get('*', (req, res) => {
    try {
      let html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');

      // Detect board slug from URL path (e.g. /board/HiltonHotel or /HiltonHotel)
      const pathParts = req.path.split('/').filter(Boolean);
      const slug = pathParts[0] === 'board' ? pathParts[1] : pathParts[0];

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const origin = `${protocol}://${host}`;
      const absoluteOgImage = `${origin}/og-image.jpg`;

      let title = 'Collaborative Client Whiteboard — Live Canvas & Feedback';
      let description = 'Real-time collaborative whiteboard for teams and clients. Draw shapes, write text, copy-paste images, and leave pinpoint feedback comments without logging in.';

      if (slug && slug !== 'index.html' && !slug.includes('.')) {
        const board = getBoard(slug.toLowerCase());
        const boardName = board?.name || slug;
        title = `${boardName} — Collaborative Whiteboard`;
        description = `Join the ${boardName} whiteboard to review designs, collaborate in real-time, and leave pinpoint feedback comments.`;
      }

      // Inject dynamic title, description, and absolute image URLs
      html = html
        .replace(/<title>.*?<\/title>/gi, `<title>${title}</title>`)
        .replace(/content="[^"]*og-image\.jpg"/gi, `content="${absoluteOgImage}"`)
        .replace(/property="og:title" content="[^"]*"/gi, `property="og:title" content="${title}"`)
        .replace(/property="og:description" content="[^"]*"/gi, `property="og:description" content="${description}"`)
        .replace(/property="og:url" content="[^"]*"/gi, `property="og:url" content="${origin}${req.path}"`)
        .replace(/name="twitter:title" content="[^"]*"/gi, `name="twitter:title" content="${title}"`)
        .replace(/name="twitter:description" content="[^"]*"/gi, `name="twitter:description" content="${description}"`)
        .replace(/name="twitter:image" content="[^"]*"/gi, `name="twitter:image" content="${absoluteOgImage}"`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.send(html);
    } catch (err) {
      console.error('Error serving index.html:', err);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(INDEX_HTML_PATH);
    }
  });
}

server.listen(PORT, () => {
  console.log(`Whiteboard Server listening on port ${PORT}`);
});
