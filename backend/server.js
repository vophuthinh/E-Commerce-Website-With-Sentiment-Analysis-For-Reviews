const app = require("./app");
const cloudinary = require("cloudinary");
const sequelize = require("./config/database");

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error(`Error: ${err.message}`);
  console.error(`Shutting down the server for handling uncaught exception`);
  process.exit(1);
});

// Load env variables
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "config/.env",
  });
}

// Connect to MySQL
sequelize
  .authenticate()
  .then(() => {
    console.log("MySQL connected...");
    // Uncomment below to sync models (use with caution in production):
    // return sequelize.sync({ alter: true });
  })
  .then(() => {
    console.log("All models synchronized successfully.");
  })
  .catch((err) => {
    console.error("Connection error:", err);
    process.exit(1);
  });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create HTTP server (Socket.io for chat is handled by the separate /socket server)
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Attach io to app.locals for use in controllers (e.g., message notifications)
app.locals.io = io;

io.on("connection", (socket) => {
  console.log("Socket client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("Socket client disconnected:", socket.id);
  });
});

// Start listening
server.listen(process.env.PORT, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error(`Shutting down the server for: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = { io };
