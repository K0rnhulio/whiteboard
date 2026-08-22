export interface Board {
  id: string;
  name: string;
  teamPrefix?: string;
  createdAt: string;
  updatedAt: string;
  passcode: string | null;
  elements: any[];
  appState: Record<string, any>;
  files: Record<string, any>;
  comments: CommentPin[];
}

export interface CommentReply {
  id: string;
  author: string;
  authorColor: string;
  text: string;
  createdAt: string;
}

export interface CommentPin {
  id: string;
  boardId: string;
  x: number;
  y: number;
  author: string;
  authorColor: string;
  text: string;
  createdAt: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  replies: CommentReply[];
}

export interface CollaboratorUser {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  role: 'editor' | 'commenter';
  pointer?: {
    x: number;
    y: number;
    tool?: string;
  };
  selectedElementIds?: Record<string, boolean>;
}

export interface RoomState {
  board: Board;
  users: Map<string, CollaboratorUser>;
}
