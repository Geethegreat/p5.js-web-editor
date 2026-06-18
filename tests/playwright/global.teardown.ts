import { MongoClient } from 'mongodb';

async function globalTeardown() {
  const client = new MongoClient(
    process.env.MONGO_URL ?? 'mongodb://localhost:27017/p5js-web-editor-test'
  );
  await client.connect();

  // Drop the entire test database — clean slate for next run
  await client.db('p5js-web-editor-test').dropDatabase();
  console.log('[teardown] Test database dropped');

  await client.close();
}

export default globalTeardown;
