import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = (session.user as { roles?: string[] }).roles || [];
    if (!roles.includes('admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    let sql = `
      SELECT n.*,
             a.period,
             sp.full_name as staff_name,
             sp.email as staff_email,
             mp.full_name as manager_name,
             u.email as recipient_email
      FROM notifications n
      LEFT JOIN assessments a ON n.assessment_id = a.id
      LEFT JOIN profiles sp ON a.staff_id = sp.user_id
      LEFT JOIN profiles mp ON a.manager_id = mp.user_id
      LEFT JOIN users u ON n.user_id = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND n.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ` ORDER BY n.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const notifications = await query(sql, params);

    return NextResponse.json({ data: notifications });
  } catch (error) {
    console.error('Admin notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    );
  }
}
