require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");

const port = process.env.PORT || 3000;

connectDB().catch((err) => {
  console.error("Initial MongoDB connection failed:", err.message);
});

app.listen(port, () => {
  console.log(`MyFinance API rodando na porta ${port}`);
});
