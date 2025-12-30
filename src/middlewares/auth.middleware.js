const jwt = require("jsonwebtoken");
const { secret } = require("../config/jwt");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token ausente" });

  const [, token] = authHeader.split(" ");

  try {
    const decoded = jwt.verify(token, secret);
    req.userId = decoded.id;
    req.familyId = decoded.familyId;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
};
