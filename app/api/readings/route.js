import clientPromise from '../../../lib/mongodb';

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

export async function GET() {
  const client = await clientPromise;
  const db = client.db('sensordata');

  const readings = await db
    .collection('readings')
    .find({})
    .sort({ receivedAt: -1 })
    .limit(50)
    .toArray();

  return Response.json(readings);
}