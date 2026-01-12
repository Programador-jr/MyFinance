const Family = require("../models/Family");
const User = require("../models/User");
const crypto = require("crypto");

exports.joinFamily = async (req, res) => {
  const { code } = req.body;
  const userId = req.userId;

  const user = await User.findById(userId);
  if (user.familyId) {
    return res.status(400).json({ error: "Usuário já pertence a uma família" });
  }

  const family = await Family.findOne({ inviteCode: code });
  if (!family) {
    return res.status(400).json({ error: "Código inválido" });
  }

  user.familyId = family._id;
  await user.save();

  res.json({ message: "Entrou na família com sucesso" });
};

exports.getFamily = async (req, res) => {
  const family = await Family.findById(req.family._id)
    .populate("ownerId", "name email");

  const members = await User.find(
    { familyId: family._id },
    "name email createdAt"
  );

  res.json({ family, members });
};

exports.getInviteCode = async (req, res) => {
  res.json({ inviteCode: req.family.inviteCode });
};

exports.regenerateInviteCode = async (req, res) => {
  req.family.inviteCode = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase();

  await req.family.save();

  res.json({
    message: "Código regenerado",
    inviteCode: req.family.inviteCode
  });
};
