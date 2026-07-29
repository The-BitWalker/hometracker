import { NextResponse } from 'next/server';
import { getDb, validateSession } from '@/lib/db';

export async function POST(request) {
  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getDb();
  try {
    const { family_code, pro_status } = user;
    const subRes = await db.execute({
      sql: 'SELECT is_plus, subscription_tier, custom_curfews, home_lat FROM family_circles WHERE family_code = ?',
      args: [family_code]
    });
    
    if (!subRes.rows.length) return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
    const circle = subRes.rows[0];
    
    const isPlus = circle.is_plus === 1 || 
                   pro_status === 'approved' || 
                   (circle.subscription_tier && circle.subscription_tier.toLowerCase() !== 'basic' && circle.subscription_tier.toLowerCase() !== 'free');

    if (!isPlus) {
      // Clear custom curfews
      await db.execute({
        sql: 'UPDATE family_circles SET custom_curfews = ? WHERE family_code = ?',
        args: ['{}', family_code]
      });

      // The free tier allows a total of 2 locations.
      const hasHome = circle.home_lat != null;
      const allowedExtraLocs = hasHome ? 1 : 2;

      const locsRes = await db.execute({
        sql: 'SELECT id FROM family_locations WHERE family_code = ? ORDER BY created_at ASC',
        args: [family_code]
      });

      if (locsRes.rows.length > allowedExtraLocs) {
        // Keep the allowed amount of oldest locations, delete the rest
        const toKeepIds = locsRes.rows.slice(0, allowedExtraLocs).map(r => r.id);
        
        if (toKeepIds.length > 0) {
          const placeholders = toKeepIds.map(() => '?').join(',');
          await db.execute({
            sql: `DELETE FROM family_locations WHERE family_code = ? AND id NOT IN (${placeholders})`,
            args: [family_code, ...toKeepIds]
          });
        } else {
          // Fallback if they somehow have 0 allowed locations (should never happen as allowed is 1 or 2)
          await db.execute({
            sql: 'DELETE FROM family_locations WHERE family_code = ?',
            args: [family_code]
          });
        }
      }

      return NextResponse.json({ success: true, message: 'Downgrade cleanup performed' });
    }

    return NextResponse.json({ success: true, message: 'User is Plus, no cleanup needed' });
  } catch (error) {
    console.error('Downgrade cleanup error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
