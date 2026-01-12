const Box = require("../models/Box");
const BoxTransaction = require("../models/BoxTransaction");

exports.list = async (req, res) => {
  res.json(await Box.find({ familyId: req.familyId }));
};

exports.move = async (req, res) => {
  const { value, type } = req.body;
  const box = await Box.findById(req.params.id);

  if (!box) return res.status(404).json({ error: "Caixinha não encontrada" });

  box.currentValue += type === "in" ? value : -value;
  await box.save();

  await BoxTransaction.create({
    boxId: box._id,
    familyId: req.familyId,
    userId: req.userId,
    type,
    value,
    date: new Date()
  });

  res.json(box);
};

exports.create = async (req, res) => {
  const { name, isEmergency = false } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Nome é obrigatório" });
  }

  const box = await Box.create({
    familyId: req.familyId,
    name: name.trim(),
    isEmergency: !!isEmergency,
    currentValue: 0
  });

  res.status(201).json(box);
};


exports.update = async (req, res) => {
  const { name, isEmergency } = req.body;

  const box = await Box.findOneAndUpdate(
    { _id: req.params.id, familyId: req.familyId },
    { name, isEmergency },
    { new: true }
  );

  if (!box) return res.status(404).json({ error: "Caixinha não encontrada" });
  res.json(box);
};

exports.remove = async (req, res) => {
  const box = await Box.findOneAndDelete({ _id: req.params.id, familyId: req.familyId });
  if (!box) return res.status(404).json({ error: "Caixinha não encontrada" });

  // opcional: limpar histórico
  await BoxTransaction.deleteMany({ boxId: box._id, familyId: req.familyId });

  res.json({ ok: true });
};
