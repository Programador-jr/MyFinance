// controllers/auth.controller.js

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const Family = require("../models/Family");
const Box = require("../models/Box");

const { sendMail } = require("../services/mail.service");
const { secret, expiresIn } = require("../config/jwt");

const FRONT_URL = process.env.FRONT_URL;

/**
 * =========================================================
 * AUTH CONTROLLER
 * - register: cria usuário e (se não tiver inviteCode) cria família
 * - login: valida credenciais e retorna { token, user } (user sanitizado)
 * - verifyEmail / forgotPassword / resendVerification / resetPassword
 * =========================================================
 */

exports.register = async (req, res) => {
  const { name, email, password, inviteCode } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(400).json({ error: "Email já cadastrado" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Token de verificação de email
  const verificationToken = crypto.randomBytes(32).toString("hex");
  let family;

  /* =============================== COM CÓDIGO → ENTRA NA FAMÍLIA ================================ */
  if (inviteCode) {
    family = await Family.findOne({ inviteCode });
    if (!family) {
      return res.status(400).json({ error: "Código de convite inválido" });
    }
  }

  /* =============================== SEM CÓDIGO → CRIA FAMÍLIA ================================ */
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: Date.now() + 1000 * 60 * 60 // 1h
  });

  if (!inviteCode) {
    const newInviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    family = await Family.create({
      name: `Família ${name}`,
      ownerId: user._id,
      inviteCode: newInviteCode
    });

    // cria a caixinha default (reserva de emergência)
    await Box.create({
      familyId: family._id,
      name: "Reserva de Emergência",
      isEmergency: true
    });
  }

  user.familyId = family._id;
  await user.save();

  const link = `${FRONT_URL}/verify-email.html?token=${verificationToken}`;

  // Obs.: aqui o html do email é simples; ok para MVP.
  await sendMail({
    to: email,
    subject: "Verifique seu email",
    html: `Olá, ${name}\n\nClique no link abaixo para verificar seu email:\n${link}`
  });

  return res.json({
    message: "Cadastro realizado. Verifique seu email.",
    familyId: family._id
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

  /**
   * Se você quiser forçar verificação de email, é só descomentar este bloco.
   * (Ele já existe no seu código, mas está comentado hoje.)
   */
  // if (!user.emailVerified) {
  //   return res.status(401).json({ error: "Email não verificado" });
  // }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Senha inválida" });

  // Token leva id + familyId (como você já faz)
  const token = jwt.sign(
    { id: user._id, familyId: user.familyId },
    secret,
    { expiresIn }
  );

  /**
   * IMPORTANTÍSSIMO:
   * - Nunca retornar password, tokens de reset/verify, etc.
   * - Retornar só o mínimo que o front precisa para UI.
   */
  const safeUser = {
    id: user._id,
    name: user.name,
    email: user.email,
    familyId: user.familyId,
    emailVerified: user.emailVerified
  };

  return res.json({ token, user: safeUser });
};

exports.verifyEmail = async (req, res) => {
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
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  // resposta “neutra” para não vazar se o email existe ou não
  if (!user) return res.json({ message: "Se existir, o email será enviado" });

  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 1000 * 60 * 30; // 30min
  await user.save();

  const link = `${FRONT_URL}/reset-password.html?token=${token}`;

  await sendMail({
    to: email,
    subject: "Recuperação de senha",
    html: `Clique no link abaixo para redefinir sua senha:\n${link}`
  });

  return res.json({ message: "Email enviado" });
};

exports.resendVerification = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ message: "Se existir, o email será reenviado" });

  if (user.emailVerified) {
    return res.status(400).json({ error: "Email já verificado" });
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = verificationToken;
  user.emailVerificationExpires = Date.now() + 1000 * 60 * 60; // 1h
  await user.save();

  const link = `${process.env.FRONT_URL}/verify-email.html?token=${verificationToken}`;

  await sendMail({
    to: user.email,
    subject: "Verifique seu email",
    html: `Olá, ${user.name}\n\nClique no link abaixo para verificar seu email:\n${link}`
  });

  return res.json({ message: "Email reenviado" });
};

exports.resetPassword = async (req, res) => {
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
};
