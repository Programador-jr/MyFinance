const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");

const authRoutes = require("./routes/auth.routes");
const transactionRoutes = require("./routes/transaction.routes");
const boxRoutes = require("./routes/box.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const categoryRoutes = require("./routes/category.routes");
const familyRoutes = require("./routes/family.routes");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Health check — NUNCA toca no banco
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "MyFinance API"
  });
});


app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("MongoDB connection error:", err);
    return res.status(503).json({
      error: "Database unavailable"
    });
  }
});

// Rotas
app.use("/auth", authRoutes);
app.use("/transactions", transactionRoutes);
app.use("/categories", categoryRoutes);
app.use("/boxes", boxRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/family", familyRoutes);

module.exports = app;
