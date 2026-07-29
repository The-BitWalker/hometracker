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

    await db.execute(`
      CREATE TABLE IF NOT EXISTS family_locations (
        id TEXT PRIMARY KEY,
        family_code TEXT NOT NULL,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        lat REAL,
        lng REAL,
        created_at TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS location_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        family_code TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS pro_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        family_code TEXT NOT NULL,
        user_name TEXT NOT NULL,
        email TEXT NOT NULL,
        family_size INTEGER NOT NULL,
        why_pro TEXT NOT NULL,
        problems_to_solve TEXT NOT NULL,
        valuable_features TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        admin_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS pro_feedback (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        family_code TEXT NOT NULL,
        month_year TEXT NOT NULL,
        times_used TEXT NOT NULL,
        members_used INTEGER NOT NULL,
        usage_situations TEXT NOT NULL,
        worked_well TEXT NOT NULL,
        problems_encountered TEXT NOT NULL,
        features_to_improve TEXT NOT NULL,
        recommendation_score INTEGER NOT NULL,
        status TEXT DEFAULT 'submitted',
        created_at TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Ensure default setting for survey interval exists
    try {
      await db.execute(`INSERT OR IGNORE INTO app_settings (setting_key, setting_value, updated_at) VALUES ('survey_interval_mode', 'test_mode', ?)`, [new Date().toISOString()]);
    } catch (_) {}

    // Ensure notification_state has current_location_name column
    try {
      await db.execute(`ALTER TABLE notification_state ADD COLUMN current_location_name TEXT`);
    } catch (_) {}

    // Ensure family_circles has subscription_tier, created_at, and custom_curfews columns
    try {
      await db.execute(`ALTER TABLE family_circles ADD COLUMN subscription_tier TEXT DEFAULT 'basic'`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE family_circles ADD COLUMN created_at TEXT`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE family_circles ADD COLUMN subscription_expires_at TEXT`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE family_circles ADD COLUMN custom_curfews TEXT`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE family_circles ADD COLUMN pro_granted_at TEXT`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE family_circles ADD COLUMN pro_revoked_at TEXT`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE family_circles ADD COLUMN pro_notes TEXT`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE users ADD COLUMN is_deactivated INTEGER DEFAULT 0`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE users ADD COLUMN pro_status TEXT DEFAULT 'none'`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE users ADD COLUMN pro_approved_at TEXT`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE users ADD COLUMN pro_approval_reason TEXT`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE users ADD COLUMN last_feedback_at TEXT`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE users ADD COLUMN feedback_postponed_until TEXT`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE users ADD COLUMN missed_feedback_count INTEGER DEFAULT 0`);
    } catch (_) {}

    try {
      await db.execute(`ALTER TABLE users ADD COLUMN deactivated_at TEXT`);
    } catch (_) {}

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
      sql: `SELECT users.id, users.name, users.email, users.role, users.family_code, users.is_deactivated, users.pro_status, users.deactivated_at
            FROM session_tokens
            JOIN users ON session_tokens.user_id = users.id
            WHERE session_tokens.token = ? AND session_tokens.expires_at > ?`,
      args: [token, now],
    });

    if (res.rows.length === 0) return null;

    const u = res.rows[0];
    if (u.role === 'admin') {
      u.family_code = 'ADMIN_GLOBAL';
    }
    return u;
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

