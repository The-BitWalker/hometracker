import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

// GET: List/search users for admin management
export async function GET(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const db = getDb();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  try {
    let sql = `
      SELECT users.id, users.name, users.email, users.role, users.family_code, users.created_at,
             users.pro_status, users.pro_approved_at, users.pro_approval_reason, users.last_feedback_at,
             family_circles.subscription_tier
      FROM users
      LEFT JOIN family_circles ON users.family_code = family_circles.family_code
    `;
    let args = [];

    if (q.trim()) {
      sql += ` WHERE users.name LIKE ? OR users.email LIKE ? OR users.family_code LIKE ?`;
      const term = `%${q.trim()}%`;
      args = [term, term, term];
    }

    sql += ` ORDER BY users.created_at DESC LIMIT 100`;

    const res = await db.execute({ sql, args });

    return NextResponse.json({ users: res.rows });
  } catch (e) {
    console.error('Admin users GET error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Manually grant or revoke Pro access for a user/circle
export async function POST(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const db = getDb();

  try {
    const body = await request.json();
    const { user_id, action, reason = '' } = body; // action: 'grant_pro' | 'revoke_pro' | 'set_role_admin' | 'set_role_parent' | 'set_role_child'

    if (!user_id || !['grant_pro', 'revoke_pro', 'set_role_admin', 'set_role_parent', 'set_role_child'].includes(action)) {
      return NextResponse.json({ error: 'Valid user_id and valid action required.' }, { status: 400 });
    }

    const uRes = await db.execute({
      sql: `SELECT * FROM users WHERE id = ?`,
      args: [user_id],
    });

    if (uRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const targetUser = uRes.rows[0];
    const now = new Date().toISOString();

    if (action === 'set_role_admin') {
      const oldCode = targetUser.family_code;
      await db.execute({
        sql: `UPDATE users SET role = 'admin', family_code = 'ADMIN_GLOBAL' WHERE id = ?`,
        args: [user_id],
      });

      // Clean database: delete circle & locations if old family circle is now empty
      if (oldCode && oldCode !== 'ADMIN_GLOBAL') {
        const countRes = await db.execute({
          sql: `SELECT COUNT(*) as cnt FROM users WHERE family_code = ?`,
          args: [oldCode],
        });
        if (countRes.rows[0]?.cnt === 0) {
          await db.execute({
            sql: `DELETE FROM family_circles WHERE family_code = ?`,
            args: [oldCode],
          });
          await db.execute({
            sql: `DELETE FROM saved_locations WHERE family_code = ?`,
            args: [oldCode],
          });
        }
      }

      return NextResponse.json({ success: true, message: `Promoted ${targetUser.email} to Admin and removed family circle.` });
    }

    if (action === 'set_role_parent') {
      await db.execute({
        sql: `UPDATE users SET role = 'parent' WHERE id = ?`,
        args: [user_id],
      });
      return NextResponse.json({ success: true, message: `Updated ${targetUser.email} role to Parent.` });
    }

    if (action === 'set_role_child') {
      await db.execute({
        sql: `UPDATE users SET role = 'child' WHERE id = ?`,
        args: [user_id],
      });
      return NextResponse.json({ success: true, message: `Updated ${targetUser.email} role to Child.` });
    }

    if (action === 'grant_pro') {
      if (targetUser.role === 'admin') {
        return NextResponse.json({ error: 'Admin accounts cannot be granted Pro access.' }, { status: 400 });
      }
      // Find parent of the family circle so Pro status is tied to parent & whole circle enjoys
      let parentUserId = user_id;
      if (targetUser.role !== 'parent') {
        const parentRes = await db.execute({
          sql: `SELECT id FROM users WHERE family_code = ? AND role = 'parent' LIMIT 1`,
          args: [targetUser.family_code],
        });
        if (parentRes.rows.length > 0) {
          parentUserId = parentRes.rows[0].id;
        }
      }

      // Grant Pro access to target user & all members in targetUser's family circle
      if (targetUser.family_code && targetUser.family_code !== 'ADMIN_GLOBAL') {
        await db.execute({
          sql: `UPDATE users SET pro_status = 'approved', pro_approved_at = ?, pro_approval_reason = ? WHERE family_code = ? OR id = ?`,
          args: [now, reason.trim() || 'Granted directly by Admin to Family Circle', targetUser.family_code, targetUser.id],
        });

        await db.execute({
          sql: `INSERT INTO family_circles (family_code, subscription_tier, pro_granted_at, updated_at)
                VALUES (?, 'plus', ?, ?)
                ON CONFLICT(family_code) DO UPDATE SET
                subscription_tier = 'plus', pro_granted_at = excluded.pro_granted_at, updated_at = excluded.updated_at`,
          args: [targetUser.family_code, now, now],
        });

        await db.execute({
          sql: `UPDATE users SET is_deactivated = 0, deactivated_at = NULL WHERE family_code = ?`,
          args: [targetUser.family_code],
        });
      } else {
        await db.execute({
          sql: `UPDATE users SET pro_status = 'approved', pro_approved_at = ?, pro_approval_reason = ?, is_deactivated = 0, deactivated_at = NULL WHERE id = ?`,
          args: [now, reason.trim() || 'Granted directly by Admin', targetUser.id],
        });
      }

      // Notify circle members
      const notifyUsersRes = targetUser.family_code && targetUser.family_code !== 'ADMIN_GLOBAL'
        ? await db.execute({ sql: `SELECT id FROM users WHERE family_code = ?`, args: [targetUser.family_code] })
        : { rows: [{ id: targetUser.id }] };

      const msg = `🎉 HomeTracker Admin has granted your family circle HomeTracker Pro lifetime access! Enjoy 10 members, unlimited places & dynamic ETAs!`;

      for (const m of notifyUsersRes.rows) {
        await db.execute({
          sql: `INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
          args: [crypto.randomUUID(), m.id, msg, now],
        });
      }

      return NextResponse.json({ success: true, message: `Granted Pro access to ${targetUser.email} and family circle.` });
    } else {
      // Revoke Pro access for all members in the family circle
      await db.execute({
        sql: `UPDATE users SET pro_status = 'revoked' WHERE family_code = ?`,
        args: [targetUser.family_code],
      });

      await db.execute({
        sql: `UPDATE family_circles SET subscription_tier = 'basic', pro_revoked_at = ?, pro_notes = ? WHERE family_code = ?`,
        args: [now, reason.trim() || 'Revoked by Admin due to inactive or non-serious feedback', targetUser.family_code],
      });

      // Soft-deactivate members beyond 4 (they remain linked to family_code!)
      const membersRes = await db.execute({
        sql: `SELECT id FROM users WHERE family_code = ? ORDER BY role DESC, created_at ASC`,
        args: [targetUser.family_code],
      });

      if (membersRes.rows.length > 4) {
        const deactivateIds = membersRes.rows.slice(4).map((m) => m.id);
        for (const dId of deactivateIds) {
          await db.execute({
            sql: `UPDATE users SET is_deactivated = 1, deactivated_at = ? WHERE id = ?`,
            args: [now, dId],
          });
          await db.execute({
            sql: `INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
            args: [
              crypto.randomUUID(),
              dId,
              `Notice: Your circle returned to Basic plan (limit 4). Your account is temporarily paused, but you remain linked to your circle. If Pro is restored within 1 week, you will automatically regain access!`,
              now,
            ],
          });
        }
      }

      await db.execute({
        sql: `INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
        args: [
          crypto.randomUUID(),
          user_id,
          `Notice: Your HomeTracker Pro Beta access has been updated to Basic. Rationale: ${reason.trim() || 'Pro Beta membership requirements not met.'}`,
          now,
        ],
      });

      return NextResponse.json({ success: true, message: `Revoked Pro access for ${targetUser.email}.` });
    }
  } catch (e) {
    console.error('Admin users POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
