# 🎨 Multi-Client Collaborative Whiteboard (Excalidraw-Style)

A fast, real-time collaborative whiteboard web application inspired by **Excalidraw**, engineered for managing distinct client whiteboards (e.g. `1clientwhiteboard`, `2clientwhiteboard`, `3clientwhiteboard`, etc.) with shareable direct links, zero login required, granular permissions (Editor vs. Commenter Only), optional passcodes, and pinpoint interactive comment pins.

---

## 🌟 Key Features

1. **Excalidraw Vector Engine**:
   - Draw shapes (rectangles, diamonds, ellipses, arrows, lines, freehand draw, text).
   - Instant **image copy & paste** (`Ctrl+V`) and file drag-and-drop.
   - Infinite canvas with smooth pan, zoom, undo/redo, and PNG export.
2. **Multi-Client Rooms & Direct Links**:
   - Unique URL per client (e.g. `http://localhost:3000/board/1clientwhiteboard` or shortcut `http://localhost:3000/1clientwhiteboard`).
   - **No login or password needed for clients**: clients join instantly by typing their name.
3. **Role Permissions (Editor vs. Commenter)**:
   - **Editor**: Full drawing, editing, pasting images, and commenting.
   - **Commenter Only**: Canvas is locked in view-only mode; clients can drop comment pins, read threads, and reply without altering drawings.
4. **Interactive Commenting & Feedback System**:
   - Drop numbered comment pins directly onto any part of the canvas.
   - Threaded replies, timestamps, author color tags, and "Resolved / Reopened" status.
   - Sidebar panel to browse and search all comments with 1-click jump-to-location.
5. **Real-Time Multiplayer Presence**:
   - Live synchronization across all connected clients via Socket.io.
   - Real-time multiplayer cursor pointers with client names and color tags.
   - Live participant avatar badges.
6. **Passcode Protection (Optional)**:
   - Secure private client rooms with an optional passcode.
7. **Admin Dashboard Hub**:
   - Create, search, duplicate, rename, and manage all client whiteboards.
   - 1-click link copying for Editor or Commenter links.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Start Both Server & Client
```bash
npm run dev
```

- **Frontend (Client)**: `http://localhost:3000`
- **Backend (Server)**: `http://localhost:4000`

---

## 📁 Project Structure

```
Whiteboard/
├── package.json              # Root scripts (dev, build, install:all)
├── server/                   # Backend (Express + Socket.io + Persistence)
│   ├── src/
│   │   ├── server.ts         # REST API & Socket.io relay
│   │   ├── storage.ts        # File-backed cache & persistence
│   │   └── types.ts          # Server TypeScript types
│   ├── data/boards/          # Persistent board JSON storage
│   └── package.json
└── client/                   # Frontend (React 18 + Vite + Excalidraw + Tailwind)
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.tsx       # Board manager & link generator
    │   │   └── WhiteboardRoom.tsx  # Interactive canvas & comment engine
    │   ├── components/
    │   │   ├── CommentOverlay.tsx    # Pinpoint canvas comments
    │   │   ├── CommentsSidebar.tsx   # Comments drawer
    │   │   ├── CollaboratorsList.tsx # Live active users
    │   │   ├── ShareModal.tsx        # Shareable link generator
    │   │   ├── PasscodeModal.tsx     # Passcode gate
    │   │   ├── NamePromptModal.tsx   # Guest name selector
    │   │   └── BoardSettingsModal.tsx# Rename & passcode settings
    │   ├── services/
    │   │   ├── socket.ts             # Socket.io client
    │   │   └── api.ts                # REST API client
    │   ├── types/                    # Shared types
    │   ├── App.tsx                   # Routes
    │   └── main.tsx
    ├── vite.config.ts
    └── package.json
```
