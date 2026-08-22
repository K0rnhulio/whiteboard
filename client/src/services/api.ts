import { BoardData, BoardSummary } from '../types';

const API_BASE = '/api';

export async function fetchBoards(): Promise<BoardSummary[]> {
  const res = await fetch(`${API_BASE}/boards`);
  if (!res.ok) throw new Error('Failed to fetch whiteboards');
  return res.json();
}

export async function createBoard(data: { id?: string; name: string; passcode?: string; teamPrefix?: string }): Promise<BoardData> {
  const res = await fetch(`${API_BASE}/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  });
  if (!res.ok) throw new Error('Failed to delete whiteboard');
}
