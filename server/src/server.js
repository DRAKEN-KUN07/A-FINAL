import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { seedDemoData } from './seed/seedData.js';

async function startServer() {
  try {
    const { uri, isMemory } = await connectDatabase();
    console.log(`[DB] Connected to MongoDB (${isMemory ? 'in-memory demo engine' : uri})`);

    if (isMemory) {
      await seedDemoData({ reset: true, quiet: false });
    }

    const server = app.listen(env.port, () => {
      console.log(`[API] Visitor Pass Management Server listening on http://localhost:${env.port}`);
    });

    const shutdown = async () => {
      console.log('\n[API] Shutting down gracefully...');
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('[API] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
