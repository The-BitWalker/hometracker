import { createClient } from '@libsql/client';

// Server-only Turso database client singleton
// This file should ONLY be imported from API routes (server-side)

let db = null;

export function getDb() {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return db;
}

// Initialize database schema (called once on first API request)
let schemaInitialized = false;

export async function ensureSchema() {
  if (schemaInitialized) return;

  const db = getDb();

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        family_code TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS session_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS family_circles (
        family_code TEXT PRIMARY KEY,
        home_address TEXT,
        home_lat REAL,
        home_lng REAL,
        target_home_time TEXT,
        updated_at TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS member_status (
        user_id TEXT PRIMARY KEY,
        family_code TEXT NOT NULL,
        current_lat REAL,
        current_lng REAL,
        updated_at TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS notification_state (
        user_id TEXT PRIMARY KEY,
        family_code TEXT NOT NULL,
        was_at_home INTEGER DEFAULT 1,
        stationary_lat REAL,
        stationary_lng REAL,
        stationary_since TEXT,
        stationary_notified INTEGER DEFAULT 0,
        curfew_notified_date TEXT
      )
    `);

    schemaInitialized = true;
  } catch (e) {
    console.error('Schema init error:', e);
  }
}

// Helper: validate session token from cookie, returns user or null
export async function validateSession(cookieHeader) {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/(?:^|;\s*)ht_session=([^;]+)/);
  if (!match) return null;

  const token = match[1];
  const db = getDb();

  try {
    const now = new Date().toISOString();
    const res = await db.execute({
      sql: `SELECT users.id, users.name, users.email, users.role, users.family_code
            FROM session_tokens
            JOIN users ON session_tokens.user_id = users.id
            WHERE session_tokens.token = ? AND session_tokens.expires_at > ?`,
      args: [token, now],
    });

    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (e) {
    console.error('Session validation error:', e);
    return null;
  }
}

// Helper: Salted PBKDF2 password hash (100k iterations)
export async function hashPassword(password, saltHex = null) {
  const encoder = new TextEncoder();
  const saltBytes = saltHex
    ? new Uint8Array(saltHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const newSaltHex = Array.from(saltBytes, (b) => b.toString(16).padStart(2, '0')).join('');

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const derivedHex = Array.from(new Uint8Array(derivedBits), (b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${newSaltHex}:${derivedHex}`;
}

// Helper: Verify password with PBKDF2 (and legacy SHA-256 fallback)
export async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;

  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const saltHex = parts[1];
    const computedHash = await hashPassword(password, saltHex);
    return computedHash === storedHash;
  }

  // Legacy fallback (unsalted SHA-256)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const legacyHash = Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
  return legacyHash === storedHash;
}

// Helper: generate secure random token
export function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Helper: generate 6-character secure family code (e.g. HT-7K9M2P)
export function generateFamilyCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `HT-${code}`;
}

// Helper: create session token cookie header value
export function sessionCookieHeader(token) {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `ht_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secureFlag}`;
}

// Helper: clear session cookie
export function clearSessionCookieHeader() {
  return `ht_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

