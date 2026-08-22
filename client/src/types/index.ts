export type UserRole = 'editor' | 'commenter';

export interface BoardSummary {
  id: string;
  name: string;
  teamPrefix?: string;
  createdAt: string;
  updatedAt: string;
  hasPasscode: boolean;
  elementCount: number;
  commentCount: number;
  openCommentCount: number;
  activeUsersCount?: number;
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
  x: number; // scene coordinate X
  y: number; // scene coordinate Y
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
  role: UserRole;
  pointer?: {
    x: number;
    y: number;
    tool?: string;
  };
  selectedElementIds?: Record<string, boolean>;
}

export interface BoardData {
  id: string;
  name: string;
  teamPrefix?: string;
  createdAt: string;
  updatedAt: string;
  hasPasscode: boolean;
  elements: any[];
  appState: Record<string, any>;
  files: Record<string, any>;
  comments: CommentPin[];
}
