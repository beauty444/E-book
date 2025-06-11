// import express from 'express';
// // import cors from 'cors';
// // import cron from 'node-cron';
// // import { sendTrialExpirationNotifications } from './utils/user_helper.js'; // Update path as needed
// import { userRouter } from './routes/userRoutes.js';
// import { Server } from "socket.io";
// import { initializeSocketIO } from "./utils/socket.js";
// import { createServer } from 'http'
// import https from 'https'
// import cors from 'cors'
// import { adminRoutes } from './routes/adminRoutes.js';
// import { authorRouter } from './routes/authorRoutes.js';
// import { paymentRouter } from './routes/paymentRoutes.js';
// // import { sendMessage } from "./utils/chatController.js";
// import { chatRouter } from './routes/chatRoutes.js';
// import  stripeWebhookRouter  from './routes/stripeWebhook.js';
// import dotenv from 'dotenv';
// dotenv.config();



// const app = express();
// // const PORT = process.env.PORT || 4005;


// const httpServer = createServer(app);
// const io = new Server(httpServer, {
//   pingTimeout: 60000,
//   cors: {
//     origin: true,
//     credentials: true,
//   },
// });
// app.set("io", io);
// app.use(
//   cors({
//     origin: true, // For multiple cors origin for production. Refer https://github.com/hiteshchoudhary/apihub/blob/a846abd7a0795054f48c7eb3e71f3af36478fa96/.env.sample#L12C1-L12C12
//     credentials: true,
//   })
// );

// // Basic CORS configuration: Allow requests from all origins
// app.use(cors());
// app.use(express.static('public'));

// // Middleware to parse JSON requests
// app.use(express.json());

// app.use(express.urlencoded());

// // Define routes
// app.use('/api/users', userRouter);
// app.use('/api/admin', adminRoutes);
// app.use('/api/author', authorRouter);
// app.use('/api/chat', chatRouter);
// app.use('/api/payment', paymentRouter);
// app.use('/api/stripe', stripeWebhookRouter);
// // app.post("/sendMessage/:chatId", sendMessage); // Define the API route

// // Root route
// app.get('/', (req, res) => {
//   res.send('CORS-enabled for all origins');
// });

// app.set("io", io);
// initializeSocketIO(io);


// httpServer.listen('4005', () => {
//   console.log(`Server running on port 4005`);
// });

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { userRouter } from './routes/userRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { authorRouter } from './routes/authorRoutes.js';
import { paymentRouter } from './routes/paymentRoutes.js';
import { chatRouter } from './routes/chatRoutes.js';
import stripeWebhookRouter from './routes/stripeWebhook.js'; // ✅ default export

import { initializeSocketIO } from './utils/socket.js';
import { onboardingRouter } from './routes/onboardingRouter.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// ✅ Mount Stripe webhook FIRST to preserve raw body
app.use('/api/stripe', stripeWebhookRouter);

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true,
}));

// Static files
app.use(express.static('public'));

// ✅ Apply JSON and URL-encoded parsers AFTER webhook route
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// App routes
app.use('/api/users', userRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/author', authorRouter);
app.use('/api/chat', chatRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/onboarding', onboardingRouter);

// Root route
app.get('/', (req, res) => {
  res.send('CORS-enabled for all origins');
});

// Socket.IO setup
const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin: true,
    credentials: true,
  },
});
app.set("io", io);
initializeSocketIO(io);

// Start server
httpServer.listen(4005, () => {
  console.log(`🚀 Server running on http://localhost:4005`);
});


// import express from "express";
// import { createServer } from "http";
// import { Server } from "socket.io";
// import dotenv from "dotenv";
// import cors from "cors";
// import { initializeSocketIO } from "./socket.js";  // Import your socket setup
// import { sendMessage } from "./controllers/chatController.js"; // Import sendMessage API

// dotenv.config();

// const app = express();
// const server = createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: "*",
//   },
// });

// // Attach Socket.io to Express app
// app.set("io", io);

// // Middlewares
// app.use(cors());
// app.use(express.json());

// // Routes
// app.post("/sendMessage/:chatId", sendMessage); // Define the API route

// // Initialize Socket.io
// initializeSocketIO(io);

// // Start Server
// const PORT = process.env.PORT || 4000;
// server.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });

