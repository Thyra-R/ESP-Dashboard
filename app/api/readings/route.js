import clientPromise from '../../../lib/mongodb';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const secret = request.headers.get('x-device-secret');
  if (secret !== process.env.DEVICE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await request.json();
  const client = await clientPromise;
  const db = client.db('sensordata');

  await db.collection('readings').insertOne({
    ...data,
    receivedAt: new Date(),
  });

  return Response.json({ success: true });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 1000);

  const client = await clientPromise;
  const db = client.db('sensordata');

  const readings = await db
    .collection('readings')
    .find({})
    .sort({ receivedAt: -1 })
    .limit(limit)
    .toArray();

  return Response.json(readings);
}