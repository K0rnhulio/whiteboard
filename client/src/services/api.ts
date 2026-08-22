import { BoardData, BoardSummary } from '../types';

const API_BASE = '/api';
const ADMIN_TOKEN_KEY = 'wb_admin_token';

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function removeAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function adminLogin(password: string): Promise<{ success: boolean; token: string }> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Invalid admin password');
  }

  const data = await res.json();
  setAdminToken(data.token);
  return data;
}

export async function verifyAdmin(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE}/admin/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminLogout(): Promise<void> {
  const token = getAdminToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/admin/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
    }
  }
  removeAdminToken();
}

function getAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchBoards(): Promise<BoardSummary[]> {
  const res = await fetch(`${API_BASE}/boards`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error('Failed to fetch whiteboards');
  }
  return res.json();
}

export async function createBoard(data: { id?: string; name: string; passcode?: string; teamPrefix?: string }): Promise<BoardData> {
  const res = await fetch(`${API_BASE}/boards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create whiteboard');
  }
  return res.json();
}

export async function fetchBoard(id: string): Promise<BoardData> {
  const res = await fetch(`${API_BASE}/boards/${id}`);
  if (!res.ok) throw new Error('Failed to load whiteboard');
  return res.json();
}

export async function verifyPasscode(id: string, passcode: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/boards/${id}/verify-passcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  });
  return res.ok;
}

export async function updateBoard(id: string, data: { name?: string; passcode?: string | null; teamPrefix?: string }): Promise<BoardData> {
  const res = await fetch(`${API_BASE}/boards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update whiteboard');
  return res.json();
}

export async function deleteBoard(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/boards/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete whiteboard');
}
