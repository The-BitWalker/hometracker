import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

// Helper: get current month string YYYY-MM
function getCurrentMonthYear() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}`;
}

// GET: Check monthly feedback status & history for Pro member
export async function GET(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    const currentMonth = getCurrentMonthYear();

    const res = await db.execute({
      sql: `SELECT * FROM pro_feedback WHERE user_id = ? ORDER BY created_at DESC`,
      args: [user.id],
    });

    const hasSubmittedThisMonth = res.rows.some((r) => r.month_year === currentMonth);

    return NextResponse.json({
      feedback_history: res.rows,
      current_month: currentMonth,
      feedback_due: !hasSubmittedThisMonth,
    });
  } catch (e) {
    console.error('Pro feedback GET error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Submit monthly Pro product feedback review
export async function POST(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    const body = await request.json();
    const now = new Date().toISOString();

    if (body.action === 'postpone') {
      const postponeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await db.execute({
        sql: `UPDATE users SET feedback_postponed_until = ? WHERE id = ?`,
        args: [postponeUntil, user.id],
      });
      return NextResponse.json({
        success: true,
        message: 'Feedback postponed for 24 hours. Your account is temporarily on Basic status for 1 day.',
      });
    }

    const {
      times_used = '10+',
      members_used = 1,
      usage_situations = '',
      worked_well = '',
      problems_encountered = '',
      features_to_improve = '',
      recommendation_score = 10,
    } = body;

    if (!worked_well.trim() || !features_to_improve.trim()) {
      return NextResponse.json({ error: 'Please fill out what worked well and what could be improved.' }, { status: 400 });
    }

    const monthYear = getCurrentMonthYear();
    const feedbackId = crypto.randomUUID();

    await db.execute({
      sql: `INSERT INTO pro_feedback
            (id, user_id, family_code, month_year, times_used, members_used, usage_situations, worked_well, problems_encountered, features_to_improve, recommendation_score, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
      args: [
        feedbackId,
        user.id,
        user.family_code,
        monthYear,
        String(times_used),
        Number(members_used) || 1,
        (usage_situations || '').trim(),
        worked_well.trim(),
        (problems_encountered || '').trim(),
        features_to_improve.trim(),
        Number(recommendation_score) || 10,
        now,
      ],
    });

    // Update user's last feedback timestamp
    await db.execute({
      sql: `UPDATE users SET last_feedback_at = ? WHERE id = ?`,
      args: [now, user.id],
    });

    // Send thank you notification
    await db.execute({
      sql: `INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
      args: [
        crypto.randomUUID(),
        user.id,
        `🌟 Thank you for submitting your monthly HomeTracker Pro feedback! Your insights directly shape our roadmap.`,
        now,
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'Monthly feedback submitted successfully! Thank you for helping build HomeTracker.',
    });
  } catch (e) {
    console.error('Pro feedback POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
