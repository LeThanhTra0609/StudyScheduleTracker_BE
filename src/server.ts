import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { initSocketHandlers } from './socket/socket.handler';

const httpServer = http.createServer(app);

// Socket.IO setup
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

initSocketHandlers(io);

// Boot
const start = async (): Promise<void> => {
  await connectDB();
  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`🌍 Environment: ${env.NODE_ENV}`);
  });
};

start();
