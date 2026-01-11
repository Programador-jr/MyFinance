const Family = require("../models/Family");

module.exports = async (req, res, next) => {
  const family = await Family.findById(req.familyId);

  if (!family) {
    return res.status(404).json({ error: "Família não encontrada" });
  }

  if (String(family.ownerId) !== req.userId) {
    return res.status(403).json({ error: "Acesso restrito ao owner" });
  }

  req.family = family;
  next();
};
