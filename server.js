
const express = require("express");
const cors = require("cors");
const dns = require("dns");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");

// Force custom DNS lookup servers to prevent Atlas connection drops
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const Enquiry = require("./models/Enquiry");

// ─── PASTE YOUR ATLAS STRING HERE ─────────────────────────────────────────────
// Replace this string with your actual connection key from MongoDB Atlas dashboard.
const MONGODB_URI = "mongodb+srv://aunjsingh351_db_user:anuj1234@cluster0.oh4wspb.mongodb.net/landingpage?appName=Cluster0";
// ──────────────────────────────────────────────────────────────────────────────

const app = express();
const PORT = 5000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: "http://localhost:5173", // Hardcoded to match your frontend dev server
  methods: ["GET", "POST"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger (dev)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── In-memory fallback ────────────────────────────────────────────────────────
const inMemoryStore = [];

// ─── Validation rules ─────────────────────────────────────────────────────────
const enquiryValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Parent name is required")
    .isLength({ min: 2, max: 60 })
    .withMessage("Name must be 2–60 characters")
    .matches(/^[\p{L}\p{M}\s.'-]+$/u) // Supports Devanagari/Hindi names
    .withMessage("Name contains invalid characters"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email address is required")
    .isEmail().withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty().withMessage("Phone number is required")
    .matches(/^[+]?[0-9\s\-()]{10,15}$/).withMessage("Please provide a valid phone number (10–13 digits)"),

  body("childName")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 60 }).withMessage("Child's name is too long"),

  body("childAge")
    .optional({ checkFalsy: true })
    .custom((val) => {
      if (val && (isNaN(val) || +val < 4 || +val > 18))
        throw new Error("Child age must be between 4 and 18");
      return true;
    }),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Health check */
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "Kidrove Workshop API",
    version: "1.0.0",
    endpoints: { enquiry: "POST /api/enquiry" },
  });
});

/**
 * POST /api/enquiry
 */
app.post("/api/enquiry", enquiryValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Please fix the following errors",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }

  const { name, email, phone, childName = "", childAge = "" } = req.body;
  const payload = { name, email, phone, childName, childAge, workshop: "AI & Robotics Summer Workshop" };

  let saved;
  let storageMode = "mongodb";
  try {
    if (mongoose.connection.readyState !== 1) throw new Error("DB not connected");
    saved = await Enquiry.create(payload);
  } catch (_dbErr) {
    console.error("❌ MongoDB Write Error details:", _dbErr.message);
    storageMode = "memory";
    saved = { ...payload, _id: `MEM-${Date.now()}`, createdAt: new Date().toISOString(), status: "pending" };
    inMemoryStore.push(saved);
    console.log(`Enquiry saved in-memory (${inMemoryStore.length} total).`);
  }

  res.status(201).json({
    success: true,
    message: "Thank you! Your registration has been received.",
    storageMode,
    data: {
      id: saved._id,
      name: saved.name,
      email: saved.email,
      workshop: saved.workshop,
      registeredAt: saved.createdAt,
    },
  });
});

// Error handling
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error." });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    console.log("🔄 Attempting Connection to MongoDB Atlas...");
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.warn("  MongoDB connection failed!");
    console.warn(`   Reason: ${err.message}`);
  }

  app.listen(PORT, () => {
    console.log(`\n Kidrove API running on http://localhost:${PORT}`);
  });
};

startServer();

module.exports = app;