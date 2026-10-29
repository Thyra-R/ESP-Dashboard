import clientPromise from '../../../lib/mongodb';
import { FIELDS } from '@/lib/fields';

export const dynamic = 'force-dynamic';

const RANGES = {
  day: { ms: 24 * 3600e3, unit: 'minute', binSize: 5 },
  week: { ms: 7 * 24 * 3600e3, unit: 'hour', binSize: 1 },
  month: { ms: 30 * 24 * 3600e3, unit: 'hour', binSize: 3 },
};

let indexReady = false;

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
  const range = searchParams.get('range');

  const client = await clientPromise;
  const col = client.db('sensordata').collection('readings');

  // Time-range queries need this index to stay fast as data grows
  if (!indexReady) {
    await col.createIndex({ receivedAt: 1 });
    indexReady = true;
  }

  if (RANGES[range]) {
    const cfg = RANGES[range];
    const group = {
      _id: { $dateTrunc: { date: '$receivedAt', unit: cfg.unit, binSize: cfg.binSize } },
    };
    for (const f of FIELDS) group[f.key] = { $avg: '$' + f.key };

    const rows = await col
      .aggregate([
        { $match: { receivedAt: { $gte: new Date(Date.now() - cfg.ms) } } },
        { $group: group },
        { $sort: { _id: 1 } },
        { $addFields: { receivedAt: '$_id' } },
      ])
      .toArray();

    return Response.json(rows); // oldest first
  }

  const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 1000);
  const rows = await col.find({}).sort({ receivedAt: -1 }).limit(limit).toArray();
  return Response.json(rows.reverse());
}