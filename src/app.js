const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");


const path = require("path");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const transactionRoutes = require("./routes/transaction.routes");
const boxRoutes = require("./routes/box.routes");
const accountRoutes = require("./routes/account.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const categoryRoutes = require("./routes/category.routes");
const familyRoutes = require("./routes/family.routes");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Health check que nao depende do banco.
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

// Rotas e arquivos estaticos.
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/transactions", transactionRoutes);
app.use("/categories", categoryRoutes);
app.use("/boxes", boxRoutes);
app.use("/accounts", accountRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/family", familyRoutes);

module.exports = app;

