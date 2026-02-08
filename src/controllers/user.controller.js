const bcrypt = require("bcrypt");
const User = require("../models/User");
const Family = require("../models/Family");
const Box = require("../models/Box");
const BoxTransaction = require("../models/BoxTransaction");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const Account = require("../models/Account");
const { put } = require("@vercel/blob");

function toSafeUser(userDoc) {
  if (!userDoc) return null;

  return {
    id: userDoc._id,
    name: userDoc.name,
    email: userDoc.email,
    familyId: userDoc.familyId,
    familyRole: userDoc.familyRole || "member",
    emailVerified: !!userDoc.emailVerified,
    avatarUrl: userDoc.avatarUrl || null,
    createdAt: userDoc.createdAt,
  };
}

function validatePasswordPolicy(password) {
  const value = String(password || "");
  const hasMinLength = value.length >= 8;
  const hasUpperCase = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);

  return {
    hasMinLength,
    hasUpperCase,
    hasNumber,
    isValid: hasMinLength && hasUpperCase && hasNumber,
  };
}

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "Usuario nao encontrado" });
    }

    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    console.error("USER GET ME ERROR:", err);
    return res.status(500).json({ error: "Erro ao buscar usuario" });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Arquivo avatar ausente" });

    const original = req.file.originalname || "avatar";
    const ext = (original.includes(".") ? original.split(".").pop() : "bin").toLowerCase();
    const key = `avatars/${req.userId}/${Date.now()}.${ext}`;

    const blob = await put(key, req.file.buffer, {
      access: "public",
      contentType: req.file.mimetype,
    });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatarUrl: blob.url },
      { new: true }
    ).select("-password");

    return res.json({ avatarUrl: user.avatarUrl, user: toSafeUser(user) });
  } catch (err) {
    console.error("USER AVATAR ERROR:", err);
    return res.status(500).json({ error: "Erro ao atualizar avatar" });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();

    if (!name) return res.status(400).json({ error: "Nome e obrigatorio" });
    if (name.length < 2) return res.status(400).json({ error: "Nome muito curto" });
    if (name.length > 60) return res.status(400).json({ error: "Nome muito longo" });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { name },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ error: "Usuario nao encontrado" });
    }

    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    console.error("USER UPDATE ERROR:", err);
    return res.status(500).json({ error: "Erro ao atualizar usuario" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Senha atual e nova senha sao obrigatorias" });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({ error: "Nova senha muito longa" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "Nova senha deve ser diferente da atual" });
    }

    const policy = validatePasswordPolicy(newPassword);
    if (!policy.isValid) {
      return res.status(400).json({
        error: "A nova senha deve ter no minimo 8 caracteres, uma letra maiuscula e um numero"
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "Usuario nao encontrado" });
    }

    const validCurrent = await bcrypt.compare(currentPassword, user.password || "");
    if (!validCurrent) {
      return res.status(400).json({ error: "Senha atual incorreta" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.json({ message: "Senha atualizada com sucesso" });
  } catch (err) {
    console.error("USER CHANGE PASSWORD ERROR:", err);
    return res.status(500).json({ error: "Erro ao alterar senha" });
  }
};

exports.deleteMe = async (req, res) => {
  try {
    const password = String(req.body?.password || "");
    if (!password) {
      return res.status(400).json({ error: "Senha e obrigatoria para excluir a conta" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "Usuario nao encontrado" });
    }

    const validPassword = await bcrypt.compare(password, user.password || "");
    if (!validPassword) {
      return res.status(400).json({ error: "Senha incorreta" });
    }

    const familyId = user.familyId;
    if (!familyId) {
      await user.deleteOne();
      return res.json({ message: "Conta excluida com sucesso" });
    }

    const family = await Family.findById(familyId);

    if (!family) {
      await user.deleteOne();
      return res.json({ message: "Conta excluida com sucesso" });
    }

    const isOwner = String(family.ownerId) === String(user._id);

    if (isOwner) {
      const membersCount = await User.countDocuments({ familyId: family._id });

      if (membersCount > 1) {
        return res.status(400).json({
          error: "Voce e owner da familia. Remova os outros membros antes de excluir sua conta."
        });
      }

      await Promise.all([
        Transaction.deleteMany({ familyId: family._id }),
        BoxTransaction.deleteMany({ familyId: family._id }),
        Box.deleteMany({ familyId: family._id }),
        Category.deleteMany({ familyId: family._id }),
        Account.deleteMany({ familyId: family._id }),
        User.deleteMany({ familyId: family._id }),
      ]);

      await family.deleteOne();
      return res.json({ message: "Conta e dados da familia excluidos com sucesso" });
    }

    await user.deleteOne();
    return res.json({ message: "Conta excluida com sucesso" });
  } catch (err) {
    console.error("USER DELETE ME ERROR:", err);
    return res.status(500).json({ error: "Erro ao excluir conta" });
  }
};
