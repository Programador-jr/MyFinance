const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const connectDB = require("../config/database");

const User = require("../models/User");
const Family = require("../models/Family");
const Box = require("../models/Box");

const { sendMail } = require("../services/mail.service");
const { secret, expiresIn } = require("../config/jwt");

const FRONT_URL = process.env.FRONT_URL;

exports.register = async (req, res) => {
  try {
    await connectDB();

    const { name, email, password, inviteCode } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: "Email já cadastrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    let family;

    if (inviteCode) {
      family = await Family.findOne({ inviteCode });
      if (!family) {
        return res.status(400).json({ error: "Código de convite inválido" });
      }
    }

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: Date.now() + 1000 * 60 * 60
    });

    if (!inviteCode) {
      // Cria familia e caixinha de emergencia no cadastro inicial.
      const newInviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();

      family = await Family.create({
        name: `Família ${name}`,
        ownerId: user._id,
        inviteCode: newInviteCode
      });

      await Box.create({
        familyId: family._id,
        name: "Reserva de Emergência",
        isEmergency: true
      });
    }

    user.familyId = family._id;
    await user.save();

    const link = `${FRONT_URL}/verify-email.html?token=${verificationToken}`;

    await sendMail({
      to: email,
      subject: "Verifique seu email",
      html: `Olá, ${name}\n\nClique no link abaixo para verificar seu email:\n${link}`
    });

    return res.json({
      message: "Cadastro realizado. Verifique seu email.",
      familyId: family._id
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

exports.login = async (req, res) => {
  try {
    await connectDB();

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Senha inválida" });

    const token = jwt.sign(
      { id: user._id, familyId: user.familyId },
      secret,
      { expiresIn }
    );

    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      familyId: user.familyId,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl || null,
    };

    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    await connectDB();

    const { token } = req.query;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: "Token inválido ou expirado" });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    return res.json({ message: "Email verificado com sucesso" });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    await connectDB();

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: "Se existir, o email será enviado" });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 30;
    await user.save();

    const link = `${FRONT_URL}/reset-password.html?token=${token}`;

    await sendMail({
      to: email,
      subject: "Recuperação de senha",
      html: `Clique no link abaixo para redefinir sua senha:\n${link}`
    });

    return res.json({ message: "Email enviado" });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    await connectDB();

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: "Se existir, o email será reenviado" });

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email já verificado" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 1000 * 60 * 60;
    await user.save();

    const link = `${FRONT_URL}/verify-email.html?token=${verificationToken}`;

    await sendMail({
      to: user.email,
      subject: "Verifique seu email",
      html: `Olá, ${user.name}\n\nClique no link abaixo para verificar seu email:\n${link}`
    });

    return res.json({ message: "Email reenviado" });
  } catch (err) {
    console.error("RESEND VERIFY ERROR:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    await connectDB();

    const { token, password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: "Token inválido ou expirado" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.json({ message: "Senha redefinida com sucesso" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};
