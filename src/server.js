require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");

const app = require("./app");

/* ============================
   ENV CONFIG
============================ */
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/it_ims";

/* ============================
   CREATE HTTP SERVER
============================ */
const server = http.createServer(app);

/* ============================
   SOCKET.IO SETUP
============================ */
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

console.log("🧠 Socket.IO initialized");

/* ============================
   LOAD SOCKET MODULES
============================ */
try {
  const socketManager = require("./socket");
  socketManager.initIO(io);
  console.log("✔ socket/index.js loaded");
} catch (err) {
  console.log("❌ socket/index.js missing:", err.message);
}

try {
  const technicianSocket = require("./socket/technicianNotification.socket");
  technicianSocket(io);
  console.log("✔ technicianNotification.socket.js loaded");
} catch (err) {
  console.log("❌ technicianNotification.socket.js missing:", err.message);
}

/* ============================
   CONNECT TO MONGODB & START
============================ */
const mongooseOptions = {
  retryWrites: false,
  authSource: 'admin',
  maxPoolSize: 5,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 10000,
  keepAlive: true,
  keepAliveInitialDelay: 30000,
  tls: true,
  tlsAllowInvalidCertificates: true,
  rejectUnauthorized: false
};

mongoose
  .connect(MONGO_URI, mongooseOptions)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    
    server.listen(PORT, () => {
      console.log(`🚀 Unified Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error("Connection string:", MONGO_URI.replace(/:[^:]*@/, ":****@"));
    
    // Attempt fallback to local MongoDB
    console.log("\n⚠️  Attempting fallback to local MongoDB...");
    mongoose
      .connect("mongodb://127.0.0.1:27017/it_ims", { 
        serverSelectionTimeoutMS: 5000 
      })
      .then(() => {
        console.log("✅ Connected to local MongoDB");
        server.listen(PORT, () => {
          console.log(`🚀 Backend running on port ${PORT} (using local MongoDB)`);
        });
      })
      .catch(() => {
        console.error("❌ Both MongoDB Atlas and local MongoDB failed");
        process.exit(1);
      });
  });

module.exports = { server, io };
