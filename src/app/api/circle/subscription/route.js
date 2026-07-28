import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

function getCurrentMonthYear() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}`;
}

// GET: Fetch Pro Beta status, limits, and feedback status info
export async function GET(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    // Fetch circle record & all circle members to check Pro status
    const circleRes = await db.execute({
      sql: `SELECT family_code, subscription_tier, subscription_expires_at, custom_curfews FROM family_circles WHERE family_code = ?`,
      args: [user.family_code],
    });
    const circle = circleRes.rows.length > 0 ? circleRes.rows[0] : null;

    const circleMembersRes = await db.execute({
      sql: `SELECT id, pro_status FROM users WHERE family_code = ?`,
      args: [user.family_code],
    });
    const hasApprovedMember = circleMembersRes.rows.some((m) => m.pro_status === 'approved');

    let tier = (circle?.subscription_tier || 'basic').toLowerCase();
    let isPlus = (tier !== 'basic' && tier !== 'free') || hasApprovedMember;

    // Auto-heal DB state: Sync family_circles & circle members when Pro is active
    if (isPlus && user.family_code && user.family_code !== 'ADMIN_GLOBAL') {
      if (!circle || circle.subscription_tier !== 'plus') {
        await db.execute({
          sql: `INSERT INTO family_circles (family_code, subscription_tier, updated_at)
                VALUES (?, 'plus', ?)
                ON CONFLICT(family_code) DO UPDATE SET subscription_tier = 'plus', updated_at = excluded.updated_at`,
          args: [user.family_code, new Date().toISOString()],
        });
      }
      await db.execute({
        sql: `UPDATE users SET pro_status = 'approved', is_deactivated = 0, deactivated_at = NULL WHERE family_code = ? AND (pro_status IS NULL OR pro_status != 'approved' OR is_deactivated = 1)`,
        args: [user.family_code],
      });
    }

    // Fetch current userDbData
    const userRes = await db.execute({
      sql: `SELECT pro_status, pro_approved_at, pro_approval_reason, last_feedback_at, feedback_postponed_until, is_deactivated, deactivated_at FROM users WHERE id = ?`,
      args: [user.id],
    });
    const userDbData = userRes.rows.length > 0 ? userRes.rows[0] : {};

    // Check emergency 24-hour postpone window
    let isPostponed = false;
    if (userDbData.feedback_postponed_until) {
      const postponedTime = new Date(userDbData.feedback_postponed_until).getTime();
      if (!isNaN(postponedTime) && Date.now() < postponedTime) {
        isPostponed = true;
      }
    }

    // Check feedback due for active Pro members (TESTING INTERVAL: 1 MINUTE)
    let feedbackDue = false;
    if (isPlus) {
      const fbRes = await db.execute({
        sql: `SELECT created_at FROM pro_feedback WHERE family_code = ? ORDER BY created_at DESC LIMIT 1`,
        args: [user.family_code],
      });
      if (fbRes.rows.length === 0) {
        feedbackDue = !isPostponed;
      } else {
        const lastFbTime = new Date(fbRes.rows[0].created_at).getTime();
        const TEST_INTERVAL_ONE_MIN = 60 * 1000; // 1 minute interval for testing
        feedbackDue = (Date.now() - lastFbTime) >= TEST_INTERVAL_ONE_MIN && !isPostponed;
      }
    }

    // If postponed: user is temporarily on Basic plan during the 24h postpone period!
    const effectiveIsPlus = isPlus && !isPostponed;

    // Active & Deactivated Member count
    const memberRes = await db.execute({
      sql: `SELECT COUNT(*) as count FROM users WHERE family_code = ? AND (is_deactivated = 0 OR is_deactivated IS NULL)`,
      args: [user.family_code],
    });
    const activeMemberCount = Number(memberRes.rows[0]?.count || 0);

    const deactivatedRes = await db.execute({
      sql: `SELECT COUNT(*) as count FROM users WHERE family_code = ? AND is_deactivated = 1`,
      args: [user.family_code],
    });
    const deactivatedMemberCount = Number(deactivatedRes.rows[0]?.count || 0);

    // Location count (Home + extra locations)
    const locRes = await db.execute({
      sql: `SELECT COUNT(*) as count FROM family_locations WHERE family_code = ?`,
      args: [user.family_code],
    });
    const homeRes = await db.execute({
      sql: `SELECT home_address FROM family_circles WHERE family_code = ?`,
      args: [user.family_code],
    });
    const hasHome = homeRes.rows.length > 0 && homeRes.rows[0].home_address && homeRes.rows[0].home_address.trim() !== '';
    const locationCount = (hasHome ? 1 : 0) + Number(locRes.rows[0]?.count || 0);

    // Fetch latest pro_request for user if any
    const reqRes = await db.execute({
      sql: `SELECT * FROM pro_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      args: [user.id],
    });
    const proRequest = reqRes.rows.length > 0 ? reqRes.rows[0] : null;

    return NextResponse.json({
      family_code: user.family_code,
      subscription_tier: effectiveIsPlus ? 'plus' : 'basic',
      is_plus: effectiveIsPlus,
      pro_status: isPlus ? 'approved' : (userDbData.pro_status || (proRequest ? proRequest.status : 'none')),
      pro_request: proRequest,
      feedback_due: feedbackDue,
      is_postponed: isPostponed,
      postponed_until: userDbData.feedback_postponed_until || null,
      last_feedback_at: userDbData.last_feedback_at || null,
      user_is_deactivated: Boolean(userDbData.is_deactivated),
      user_deactivated_at: userDbData.deactivated_at || null,
      custom_curfews: circle?.custom_curfews ? JSON.parse(circle.custom_curfews) : {},
      deactivated_members_count: deactivatedMemberCount,
      limits: {
        max_members: effectiveIsPlus ? 10 : 4,
        current_members: activeMemberCount,
        deactivated_members: deactivatedMemberCount,
        max_locations: effectiveIsPlus ? 50 : 2,
        current_locations: locationCount,
        history_days: effectiveIsPlus ? 30 : 1,
        dynamic_traffic_eta: effectiveIsPlus,
        custom_member_curfews: effectiveIsPlus,
      },
    });
  } catch (e) {
    console.error('Subscription GET error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Admin toggle / legacy fallback endpoint
export async function POST(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Parent or Admin account required.' }, { status: 403 });
  }

  return NextResponse.json({
    error: 'Direct purchase is disabled. Please submit a HomeTracker Pro Beta Application.',
    redirect: '/dashboard?action=request_pro',
  }, { status: 400 });
}
