import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { initSocketHandlers } from './socket/socket.handler';
import { initCronJobs } from './services/cron.service';

const httpServer = http.createServer(app);

// Socket.IO setup – allow same origins as Express CORS
const socketOrigins = [
  env.CLIENT_URL,
  /^https:\/\/.*\.vercel\.app$/,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = socketOrigins.some((allowed) =>
        allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
      );
      callback(isAllowed ? null : new Error('Socket.IO CORS blocked'), isAllowed);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

initSocketHandlers(io);

// Boot
const start = async (): Promise<void> => {
  await connectDB();
  initCronJobs();
  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`🌍 Environment: ${env.NODE_ENV}`);
  });
};

start();
