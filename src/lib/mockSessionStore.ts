/**
 * File-backed store for mock checkout sessions (used when no real Stripe key is configured).
 * Sessions expire after 30 minutes and are persisted to disk so they survive tsx watch restarts.
 * When a real Stripe key is added to .env, this file becomes unused.
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { CheckoutPayload } from '../types';

interface MockSession {
  payload: CheckoutPayload & { userId?: string };
  expiresAt: number;
  products: { id: string; name: string; price: string; quantity: number }[];
  total: number;
}

type Store = Record<string, MockSession>;

const STORE_FILE = path.join(process.cwd(), '.mock-sessions.json');
const TTL_MS = 30 * 60 * 1000;

function readStore(): Store {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store), 'utf-8');
  } catch {
    // Non-fatal — fall back to in-memory only for this write
  }
}

export function createMockSession(
  payload: CheckoutPayload & { userId?: string },
  products: { id: string; name: string; price: string; quantity: number }[],
  total: number
): string {
  const sessionId = `mock_${randomUUID()}`;
  const store = readStore();
  store[sessionId] = {
    payload,
    expiresAt: Date.now() + TTL_MS,
    products,
    total,
  };
  writeStore(store);
  return sessionId;
}

export function getMockSession(sessionId: string): MockSession | null {
  const store = readStore();
  const session = store[sessionId];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete store[sessionId];
    writeStore(store);
    return null;
  }
  return session;
}

export function deleteMockSession(sessionId: string): void {
  const store = readStore();
  delete store[sessionId];
  writeStore(store);
}
