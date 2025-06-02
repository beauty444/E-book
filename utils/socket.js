import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { ChatEventEnum } from '../utils/constants.js';
import { PrismaClient } from '@prisma/client';
import dotenv from "dotenv";
import { sendMessagesByAuthor, sendMessagesByUser, } from '../utils/helper.js';
// Import sendMessage API

dotenv.config();
const prisma = new PrismaClient();

const mountJoinChatEvent = (socket) => {
  socket.on(ChatEventEnum.JOIN_CHAT_EVENT, (chatId) => {
    console.log(`User joined the chat 🤝. chatId: `, chatId);
    socket.join(chatId);
  });
};

const mountParticipantTypingEvent = (socket) => {
  socket.on(ChatEventEnum.TYPING_EVENT, (chatId) => {
    socket.in(chatId).emit(ChatEventEnum.TYPING_EVENT, chatId);
  });
};

const mountParticipantStoppedTypingEvent = (socket) => {
  socket.on(ChatEventEnum.STOP_TYPING_EVENT, (chatId) => {
    socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId);
  });
};

const initializeSocketIO = (io) => {
  return io.on("connection", async (socket) => {
    console.log("User connected 🗼");
    try {
      const authHeader = socket.handshake.headers.authorization;

      if (!authHeader) {
        console.log("Authorization header is missing");
        socket.emit('unauthorized', {
          status: 401,
          message: 'Authorization header is missing',
          success: false,
        });
        return socket.disconnect();
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      console.log('decoded', decoded);

      const isUser = socket.handshake.query.isUser === '1';
      let user;

      if (isUser) {
        user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      } else {
        user = await prisma.author.findUnique({ where: { id: decoded.authorId } });
      }

      console.log('user', user)

      if (!user) {
        console.log("Unauthorized handshake. Invalid token.");
        socket.emit('unauthorized', {
          status: 401,
          message: 'Unauthorized handshake. Invalid token',
          success: false,
        });
        return socket.disconnect();
      }

      socket.user = user;
      const roomName = isUser ? `user_${user.id}` : `author_${user.id}`;
      socket.join(roomName);
      console.log('roomName', roomName)
      if (isUser) {
        await prisma.user.update({ where: { id: user.id }, data: { isOnline: 1 } });
      }
      else {
        await prisma.author.update({ where: { id: user.id }, data: { isOnline: 1 } });
      }


      socket.emit(ChatEventEnum.CONNECTED_EVENT);
      console.log("User connected 🗼. userId:", user.id);

      // **NEW** - Handle incoming messages via socket
      socket.on(ChatEventEnum.SEND_MESSAGE_EVENT, async ({ event, data }) => {
        console.log(`Received message event:`, event);
        console.log('data.chatId', data);

        // const fileNames = Array.isArray(data.fileNames) ? data.fileNames.join(",") : data.fileNames || null;

        // Mock req & res for API call
        const res = {}
        const req = {
          user: socket.user,
          params: { chatId: data.chatId },
          body: {
            content: data.content,
            isLink: data.isLink,
            fileNames: data.fileNames
          },
          app: { get: (key) => io } // Simulating req.app.get("io")
        };
        if (data.isUser == '1') {
          console.log("user it is >>>>>>>>>>>>>>>>>>>>>>>>")
          await sendMessagesByUser(req, res);
        }
        else {
          console.log("author it is >>>>>>>>>>>>>>>>>>>>>>>>")
          await sendMessagesByAuthor(req, res);
        }

      });

      socket.on(ChatEventEnum.DISCONNECT_EVENT, async () => {
        console.log("User disconnected 🚫. userId:", socket.user.id);

        try {
          if (isUser) {
            await prisma.user.update({ where: { id: socket.user.id }, data: { isOnline: 0 } });
          } else {
            await prisma.author.update({ where: { id: socket.user.id }, data: { isOnline: 0 } });
          }
        } catch (err) {
          console.error("Error updating user offline status:", err.message);
        }

        if (socket.id) {
          socket.leave(socket.id);
        }
      });

    } catch (error) {
      console.log(error);
      socket.emit(
        ChatEventEnum.SOCKET_ERROR_EVENT,
        error?.message || "Error connecting to the socket."
      );
    }
  });
};

const emitSocketEvent = (req, roomId, event, payload) => {
  console.log('emitSocketEvent', emitSocketEvent);
  console.log('roomId', roomId);
  console.log('event', event);
  console.log('payload', payload);

  req.app.get("io").in(roomId).emit(event, payload);
};

export { initializeSocketIO, emitSocketEvent };


//   return io.on("connection", async (socket) => {
//     console.log("User connected 🗼");

//     try {
//       const authHeader = socket.handshake.headers.authorization;

//       if (!authHeader) {
//         console.log("Authorization header is missing");
//         socket.emit('unauthorized', {
//           status: 401,
//           message: 'Authorization header is missing',
//           success: false,
//         });
//         return socket.disconnect();
//       }

//       const token = authHeader.replace('Bearer ', '');
//       const decoded = jwt.verify(token, process.env.SECRET_KEY);
//       const isUser = socket.handshake.query.isUser === '1';

//       let user;

//       if (isUser) {
//         user = await prisma.user.findUnique({ where: { id: decoded.userId } });
//       } else {
//         user = await prisma.author.findUnique({ where: { id: decoded.authorId } });
//       }

//       if (!user) {
//         console.log("Unauthorized handshake. Invalid token.");
//         socket.emit('unauthorized', {
//           status: 401,
//           message: 'Unauthorized handshake. Invalid token',
//           success: false,
//         });
//         return socket.disconnect();
//       }

//       socket.user = user;
//       socket.isUser = isUser;

//       const roomName = isUser ? `user_${user.id}` : `author_${user.id}`;
//       socket.join(roomName);
//       console.log('Joined room:', roomName);

//       // ✅ Set user as online
//       if (isUser) {
//         await prisma.user.update({ where: { id: user.id }, data: { isOnline: 1 } });
//       } else {
//         await prisma.author.update({ where: { id: user.id }, data: { isOnline: 1 } });
//       }

//       socket.emit(ChatEventEnum.CONNECTED_EVENT);
//       console.log("User connected 🗼. userId:", user.id);

//       // 🔄 Handle message send
//       socket.on(ChatEventEnum.SEND_MESSAGE_EVENT, async ({ event, data }) => {
//         const req = {
//           user: socket.user,
//           params: { chatId: data.chatId },
//           body: {
//             content: data.content,
//             isLink: data.isLink,
//             fileNames: data.fileNames,
//           },
//           app: { get: (key) => io }
//         };
//         const res = {};

//         if (data.isUser === '1') {
//           await sendMessagesByUser(req, res);
//         } else {
//           await sendMessagesByAuthor(req, res);
//         }
//       });

//       // ❌ Disconnect (real socket disconnect event)
//       socket.on("disconnect", async () => {
//         console.log("User disconnected 🚫. userId:", socket.user.id);

//         try {
//           if (socket.isUser) {
//             await prisma.user.update({ where: { id: socket.user.id }, data: { isOnline: 0 } });
//           } else {
//             await prisma.author.update({ where: { id: socket.user.id }, data: { isOnline: 0 } });
//           }
//         } catch (err) {
//           console.error("Error updating user offline status:", err.message);
//         }

//         // Optionally leave the room
//         const roomName = socket.isUser ? `user_${socket.user.id}` : `author_${socket.user.id}`;
//         socket.leave(roomName);
//       });

//     } catch (error) {
//       console.error("Socket connection error:", error);
//       socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, error?.message || "Error connecting to the socket.");
//     }
//   });
// };


// const emitSocketEvent = (req, roomId, event, payload) => {
//   console.log('emitSocketEvent', emitSocketEvent);
//   console.log('roomId', roomId);
//   console.log('event', event);
//   console.log('payload', payload);

//   req.app.get("io").in(roomId).emit(event, payload);
// };

// export { initializeSocketIO, emitSocketEvent };