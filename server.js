


require("dotenv").config();

const express = require("express");
const cors = require("cors");
const dns = require("dns");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const Enquiry = require("./models/Enquiry");

const app = express();

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://kid-drove-frontend.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.path}`
  );
  next();
});

// MongoDB Connection
const connectDB = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log(
      "Mongo URI Found:",
      !!process.env.MONGODB_URI
    );

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:");
    console.error(err.message);
  }
};

connectDB();

// Validation
const enquiryValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Parent name is required"),

  body("email")
    .trim()
    .notEmpty()
    .isEmail()
    .withMessage("Valid email required"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number required"),
];

// Health Route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Kidrove API Running",
  });
});

// Submit Enquiry
app.post(
  "/api/enquiry",
  enquiryValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(422).json({
          success: false,
          errors: errors.array(),
        });
      }

      const {
        name,
        email,
        phone,
        childName,
        childAge,
      } = req.body;

      const enquiry = await Enquiry.create({
        name,
        email,
        phone,
        childName,
        childAge,
        workshop: "AI & Robotics Summer Workshop",
      });

      return res.status(201).json({
        success: true,
        message: "Registration successful",
        data: enquiry,
      });
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Local Development
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(
      `🚀 Server running on http://localhost:${PORT}`
    );
  });
}

module.exports = app;
