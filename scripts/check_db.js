const { createClient } = require('@libsql/client');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = envLocal.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) acc[key.trim()] = value.join('=').trim();
  return acc;
}, {});

const db = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

async function run() {
  const users = await db.execute('SELECT * FROM users');
  console.log('Users:', users.rows);
  
  const notifs = await db.execute('SELECT * FROM notifications');
  console.log('Notifications:', notifs.rows);
  
  const state = await db.execute('SELECT * FROM notification_state');
  console.log('Notification state:', state.rows);
}

run().catch(console.error);

run().catch(console.error);
