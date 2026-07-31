import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession, logLifecycle } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ============================================================
// Haversine distance in km
// ============================================================
function distanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// Constants
// ============================================================
const HOME_THRESHOLD_KM = 0.1;        // 100 m
const STATIONARY_THRESHOLD_KM = 0.05; // 50 m
const STATIONARY_MINUTES = 10;
const CURFEW_WINDOW_HOURS = 4;

// ============================================================
// Helpers
// ============================================================

/** Insert a personalized notification for EVERY member in the family circle */
async function notifyFamily(db, familyCode, targetUserId, selfMessage, otherMessage) {
  const now = new Date().toISOString();
  const members = await db.execute({
    sql: `SELECT id FROM users WHERE family_code = ?`,
    args: [familyCode],
  });

  for (const member of members.rows) {
    const id = crypto.randomUUID();
    const msg = member.id === targetUserId ? selfMessage : otherMessage;
    await db.execute({
      sql: `INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
      args: [id, member.id, msg, now],
    });
  }
}

/** Ensure a notification_state row exists for this member */
async function ensureNotificationState(db, userId, familyCode) {
  await db.execute({
    sql: `INSERT OR IGNORE INTO notification_state (user_id, family_code, was_at_home, stationary_notified)
          VALUES (?, ?, 1, 0)`,
    args: [userId, familyCode],
  });
}

/**
 * Check if currentMinutes falls inside the curfew-late window.
 * The window starts at curfewMinutes and lasts CURFEW_WINDOW_HOURS hours.
 * Handles midnight wrap-around.
 */
function isWithinCurfewWindow(currentMinutes, curfewMinutes) {
  const windowEnd = 5 * 60; // Curfew always expires at 05:00 AM

  if (curfewMinutes < windowEnd) {
    return currentMinutes >= curfewMinutes && currentMinutes < windowEnd;
  } else {
    // Midnight wrap
    return currentMinutes >= curfewMinutes || currentMinutes < windowEnd;
  }
}

/**
 * Run notification checks for a single child member.
 * Called both from the child's location push AND from the parent's poll.
 */
async function evaluateNotifications(db, member, home, extraLocations = []) {
  const lat = member.current_lat;
  const lng = member.current_lng;
  if (lat == null || lng == null) return;
  if (!home || home.home_lat == null || home.home_lng == null) return;

  await ensureNotificationState(db, member.id, member.family_code);

  // Fetch current notification state
  const stateRes = await db.execute({
    sql: `SELECT * FROM notification_state WHERE user_id = ?`,
    args: [member.id],
  });
  const state = stateRes.rows[0];
  if (!state) return;

  // Build complete list of saved locations
  const allLocations = [
    { name: 'Home', lat: home.home_lat, lng: home.home_lng, isHome: true },
    ...extraLocations.map((loc) => ({ name: loc.name, lat: loc.lat, lng: loc.lng, isHome: false })),
  ];

  // Find if member is currently near any saved location
  let currentNearLocation = null;
  for (const loc of allLocations) {
    if (loc.lat != null && loc.lng != null) {
      const d = distanceKm(lat, lng, loc.lat, loc.lng);
      if (d <= HOME_THRESHOLD_KM) {
        currentNearLocation = loc;
        break;
      }
    }
  }

  // Current location name (or null if not at any saved location)
  const currentLocName = currentNearLocation ? currentNearLocation.name : null;

  // Previous location name stored in DB (backward compatibility fallback with was_at_home)
  let prevLocName = state.current_location_name;
  if (prevLocName === undefined || prevLocName === null) {
    prevLocName = state.was_at_home === 1 ? 'Home' : null;
  }

  // ========== A. Leaving / Arriving Location Detection ==========
  if (prevLocName && prevLocName !== currentLocName) {
    // Member left previous location
    const icon = prevLocName === 'Home' ? '🏠' : '📍';
    await notifyFamily(
      db,
      member.family_code,
      member.id,
      `🚶 You have left ${prevLocName}`,
      `🚶 ${member.name} has left ${prevLocName}`
    );
  }

  if (currentLocName && currentLocName !== prevLocName) {
    // Member arrived at new location
    const icon = currentLocName === 'Home' ? '🏠' : '📍';
    await notifyFamily(
      db,
      member.family_code,
      member.id,
      `${icon} You have arrived at ${currentLocName}`,
      `${icon} ${member.name} has arrived at ${currentLocName}`
    );
  }

  if (prevLocName !== currentLocName) {
    const isAtHomeInt = currentLocName === 'Home' ? 1 : 0;
    await db.execute({
      sql: `UPDATE notification_state SET was_at_home = ?, current_location_name = ? WHERE user_id = ?`,
      args: [isAtHomeInt, currentLocName, member.id],
    });
  }

  const isAtHome = currentLocName === 'Home';

  // ========== B. Stationary Detection (10+ minutes, outside home only) ==========
  if (!currentLocName) {
    if (state.stationary_lat != null && state.stationary_lng != null) {
      const distFromStationary = distanceKm(lat, lng, state.stationary_lat, state.stationary_lng);

      if (distFromStationary < STATIONARY_THRESHOLD_KM) {
        if (state.stationary_since && state.stationary_notified === 0) {
          const stationarySince = new Date(state.stationary_since);
          const minutesStationary = (Date.now() - stationarySince.getTime()) / 60000;

          if (minutesStationary >= STATIONARY_MINUTES) {
            await notifyFamily(
              db,
              member.family_code,
              member.id,
              '📍 You have been stationary for 10+ minutes',
              `📍 ${member.name} has been stationary for 10+ minutes`
            );
            await db.execute({
              sql: `UPDATE notification_state SET stationary_notified = 1 WHERE user_id = ?`,
              args: [member.id],
            });
          }
        }
      } else {
        // Moved significantly — reset stationary tracking
        const now = new Date().toISOString();
        await db.execute({
          sql: `UPDATE notification_state SET stationary_lat = ?, stationary_lng = ?, stationary_since = ?, stationary_notified = 0 WHERE user_id = ?`,
          args: [lat, lng, now, member.id],
        });
      }
    } else {
      // First check outside saved location — initialise stationary tracking
      const now = new Date().toISOString();
      await db.execute({
        sql: `UPDATE notification_state SET stationary_lat = ?, stationary_lng = ?, stationary_since = ?, stationary_notified = 0 WHERE user_id = ?`,
        args: [lat, lng, now, member.id],
      });
    }
  } else {
    // Member is at a saved location — clear stationary tracking
    if (state.stationary_lat != null) {
      await db.execute({
        sql: `UPDATE notification_state SET stationary_lat = NULL, stationary_lng = NULL, stationary_since = NULL, stationary_notified = 0 WHERE user_id = ?`,
        args: [member.id],
      });
    }
  }

  // ========== C. Curfew Late Detection (Smart Window) ==========
  if (home.target_home_time && !isAtHome) {
    const [curfewH, curfewM] = home.target_home_time.split(':').map(Number);
    const curfewMinutes = curfewH * 60 + curfewM;

    const nowDate = new Date();
    const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const todayStr = nowDate.toISOString().slice(0, 10);

    if (
      isWithinCurfewWindow(currentMinutes, curfewMinutes) &&
      state.curfew_notified_date !== todayStr
    ) {
      await notifyFamily(
        db,
        member.family_code,
        member.id,
        `⚠️ You are past curfew (${home.target_home_time}) and not home`,
        `⚠️ ${member.name} is past curfew (${home.target_home_time}) and not home`
      );
      await db.execute({
        sql: `UPDATE notification_state SET curfew_notified_date = ? WHERE user_id = ?`,
        args: [todayStr, member.id],
      });
    }
  }
}

// Export for reuse in location update route
export { evaluateNotifications, distanceKm, HOME_THRESHOLD_KM };

// ============================================================
// GET handler — called by the dashboard poll to evaluate
// notification checks for ALL child members in the family.
// ============================================================
export async function GET(request) {
  const startTime = Date.now();
  logLifecycle('API_NOTIF_CHECK_START');

  try {
    await ensureSchema();

    const user = await validateSession(request.headers.get('cookie'));
    if (!user) {
      logLifecycle('API_NOTIF_CHECK_UNAUTHENTICATED', { durationMs: Date.now() - startTime });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();

    // Fetch home info
    const homeRes = await db.execute({
      sql: `SELECT home_lat, home_lng, target_home_time FROM family_circles WHERE family_code = ?`,
      args: [user.family_code],
    });
    const home = homeRes.rows.length > 0 ? homeRes.rows[0] : null;

    if (!home || home.home_lat == null) {
      logLifecycle('API_NOTIF_CHECK_NO_HOME', { durationMs: Date.now() - startTime });
      return NextResponse.json({ checked: false, reason: 'no_home' });
    }

    // Fetch extra locations for this family
    const locRes = await db.execute({
      sql: `SELECT id, name, address, lat, lng FROM family_locations WHERE family_code = ?`,
      args: [user.family_code],
    });
    const extraLocations = locRes.rows;

    // Fetch all child members with their latest location
    const membersRes = await db.execute({
      sql: `SELECT users.id, users.name, users.family_code,
                   member_status.current_lat, member_status.current_lng, member_status.updated_at
            FROM users
            LEFT JOIN member_status ON users.id = member_status.user_id
            WHERE users.family_code = ? AND users.role = 'child'`,
      args: [user.family_code],
    });

    for (const member of membersRes.rows) {
      if (member.current_lat != null && member.current_lng != null) {
        await evaluateNotifications(db, member, home, extraLocations);
      }
    }

    logLifecycle('API_NOTIF_CHECK_SUCCESS', { membersChecked: membersRes.rows.length, durationMs: Date.now() - startTime });

    return NextResponse.json({ checked: true, members_checked: membersRes.rows.length });
  } catch (e) {
    logLifecycle('API_NOTIF_CHECK_ERROR', { error: e.message, stack: e.stack, durationMs: Date.now() - startTime });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
