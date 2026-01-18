const User = require("../models/User");
const { put } = require("@vercel/blob");

exports.uploadAvatar = async (req, res) => {
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

  return res.json({ avatarUrl: user.avatarUrl, user });
};

exports.updateMe = async (req, res) => {
  const name = String(req.body?.name || "").trim();

  if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
  if (name.length < 2) return res.status(400).json({ error: "Nome muito curto" });
  if (name.length > 60) return res.status(400).json({ error: "Nome muito longo" });

  const user = await User.findByIdAndUpdate(
    req.userId,
    { name },
    { new: true, runValidators: true }
  ).select("-password");

  return res.json({ user });
};