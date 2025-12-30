require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");

connectDB();

app.listen(process.env.PORT, () => {
  console.log(`MyFinance API rodando na porta ${process.env.PORT}`);
});
