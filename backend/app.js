const express = require("express");
const ErrorHandler = require("./middleware/error");
const app = express();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const mongoSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");


app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

app.use("/api/", limiter);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Security headers with Helmet (includes XSS protection)
app.use(helmet());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Static files
app.use("/", express.static(path.join(__dirname, "./uploads")));
app.use("/test", (req, res) => {
  res.send("Hello world!");
});

// config
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "config/.env",
  });
}

// import routes
const user = require("./controller/user");
const shop = require("./controller/shop");
const product = require("./controller/product");
const event = require("./controller/event");
const coupon = require("./controller/coupounCode");
const payment = require("./controller/payment");
const order = require("./controller/order");
const conversation = require("./controller/conversation");
const message = require("./controller/message");
const withdraw = require("./controller/withdraw");
const User = require("./model/user");

app.use("/api/v2/user", user);
app.use("/api/v2/conversation", conversation);
app.use("/api/v2/message", message);
app.use("/api/v2/order", order);
app.use("/api/v2/shop", shop);
app.use("/api/v2/product", product);
app.use("/api/v2/event", event);
app.use("/api/v2/coupon", coupon);
app.use("/api/v2/payment", payment);
app.use("/api/v2/withdraw", withdraw);
// Update user role - Protected route (Admin only)
app.put(
  "/api/v2/user/update-role/:id",
  require("./middleware/auth").isAuthenticated,
  require("./middleware/auth").isAdmin("Admin"),
  require("./middleware/catchAsyncErrors")(async (req, res, next) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        return next(new require("./utils/ErrorHandler")("User not found", 404));
      }
      const { role } = req.body;
      
      if (!role) {
        return next(new require("./utils/ErrorHandler")("Role is required", 400));
      }
      
      // Validate role value
      const validRoles = ["user", "Admin", "Seller"];
      if (!validRoles.includes(role)) {
        return next(new require("./utils/ErrorHandler")("Invalid role", 400));
      }
      
      user.role = role;
      await user.save();
      
      return res.status(200).json({
        success: true,
        message: "Role updated successfully",
        user,
      });
    } catch (error) {
      return next(new require("./utils/ErrorHandler")(error.message, 500));
    }
  })
);

app.use(ErrorHandler);
module.exports = app;
