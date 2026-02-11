require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");

const port = process.env.PORT || 3000;
const ip = process.env.IP_ADRESS;

connectDB().catch((err) => {
  console.error("Initial MongoDB connection failed:", err.message);
});

app.listen(port, ip, () => {
  console.log(`MyFinance API rodando em http://${ip}:${port}`);
});
