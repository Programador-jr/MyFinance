const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Family = require("../models/Family");
const Box = require("../models/Box");
const { secret, expiresIn } = require("../config/jwt");

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: "Email já cadastrado" });

  const family = await Family.create({ name: `Família ${name}` });

  await Box.create({
    familyId: family._id,
    name: "Reserva de Emergência",
    isEmergency: true
  });

  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 10),
    familyId: family._id
  });

  res.json(user);
};

exports.login = async (req, res) => {
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

  res.json({ token });
};
