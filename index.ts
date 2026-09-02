import { startServer } from './src/server.ts';

// Keep the server reference alive for Bun's event loop.
const server = startServer();

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
