import { Server as SocketIOServer, Socket } from 'socket.io';

// Map userId → socketId for targeted emit
const userSocketMap = new Map<string, string>();

export const initSocketHandlers = (io: SocketIOServer): void => {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Client joins their personal room after login
    socket.on('user:join', (userId: string) => {
      socket.join(`user:${userId}`);
      userSocketMap.set(userId, socket.id);
      console.log(`👤 User ${userId} joined room user:${userId}`);
    });

    // Client leaves on logout
    socket.on('user:leave', (userId: string) => {
      socket.leave(`user:${userId}`);
      userSocketMap.delete(userId);
      console.log(`👤 User ${userId} left room`);
    });

    socket.on('disconnect', () => {
      // Clean up map on disconnect
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          break;
        }
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

// Helper: emit to specific user's room
export const emitToUser = (
  io: SocketIOServer,
  userId: string,
  event: string,
  data: unknown
): void => {
  io.to(`user:${userId}`).emit(event, data);
};
