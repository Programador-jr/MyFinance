const Family = require("../models/Family");
const User = require("../models/User");
const crypto = require("crypto");

exports.joinFamily = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    if (user.familyId) {
      return res.status(400).json({ error: "Usuário já pertence a uma família" });
    }

    // Valida o codigo de convite informado.
    const family = await Family.findOne({ inviteCode: code });
    if (!family) {
      return res.status(400).json({ error: "Código inválido" });
    }

    user.familyId = family._id;
    await user.save();

    return res.json({ message: "Entrou na família com sucesso" });

  } catch (err) {
    console.error("Join family error:", err);
    return res.status(500).json({ error: "Erro ao entrar na família" });
  }
};

exports.getFamily = async (req, res) => {
  try {
    const family = await Family.findById(req.family._id)
      .populate("ownerId", "name email");

    if (!family) {
      return res.status(404).json({ error: "Família não encontrada" });
    }

    const members = await User.find(
      { familyId: family._id },
      "name email createdAt"
    );

    return res.json({ family, members });

  } catch (err) {
    console.error("Get family error:", err);
    return res.status(500).json({ error: "Erro ao buscar família" });
  }
};

exports.getInviteCode = async (req, res) => {
  try {
    return res.json({ inviteCode: req.family.inviteCode });
  } catch (err) {
    console.error("Get invite code error:", err);
    return res.status(500).json({ error: "Erro ao obter código" });
  }
};

exports.regenerateInviteCode = async (req, res) => {
  try {
    // Gera um novo codigo de convite.
    req.family.inviteCode = crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase();

    await req.family.save();

    return res.json({
      message: "Código regenerado",
      inviteCode: req.family.inviteCode
    });

  } catch (err) {
    console.error("Regenerate invite code error:", err);
    return res.status(500).json({ error: "Erro ao regenerar código" });
  }
};
