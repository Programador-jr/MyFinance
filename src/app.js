const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const transactionRoutes = require("./routes/transaction.routes");
const boxRoutes = require("./routes/box.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();

app.use(cors({
  origin: "*"
}));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/transactions", transactionRoutes);
app.use("/boxes", boxRoutes);
app.use("/dashboard", dashboardRoutes);

module.exports = app;
