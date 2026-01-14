const connectDB = require("../config/database");

const Box = require("../models/Box");
const BoxTransaction = require("../models/BoxTransaction");

exports.list = async (req, res) => {
  try {
    await connectDB();

    const boxes = await Box.find({ familyId: req.familyId });
    return res.json(boxes);
  } catch (err) {
    console.error("BOX LIST ERROR:", err);
    return res.status(500).json({ error: "Erro ao listar caixinhas" });
  }
};

exports.move = async (req, res) => {
  try {
    await connectDB();

    const { value, type } = req.body;
    const box = await Box.findById(req.params.id);

    if (!box) {
      return res.status(404).json({ error: "Caixinha não encontrada" });
    }

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

    return res.json(box);
  } catch (err) {
    console.error("BOX MOVE ERROR:", err);
    return res.status(500).json({ error: "Erro ao movimentar caixinha" });
  }
};

exports.create = async (req, res) => {
  try {
    await connectDB();

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

    return res.status(201).json(box);
  } catch (err) {
    console.error("BOX CREATE ERROR:", err);
    return res.status(500).json({ error: "Erro ao criar caixinha" });
  }
};

exports.update = async (req, res) => {
  try {
    await connectDB();

    const { name, isEmergency } = req.body;

    const box = await Box.findOneAndUpdate(
      { _id: req.params.id, familyId: req.familyId },
      { name, isEmergency },
      { new: true }
    );

    if (!box) {
      return res.status(404).json({ error: "Caixinha não encontrada" });
    }

    return res.json(box);
  } catch (err) {
    console.error("BOX UPDATE ERROR:", err);
    return res.status(500).json({ error: "Erro ao atualizar caixinha" });
  }
};

exports.remove = async (req, res) => {
  try {
    await connectDB();

    const box = await Box.findOneAndDelete({
      _id: req.params.id,
      familyId: req.familyId
    });

    if (!box) {
      return res.status(404).json({ error: "Caixinha não encontrada" });
    }

    await BoxTransaction.deleteMany({
      boxId: box._id,
      familyId: req.familyId
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("BOX REMOVE ERROR:", err);
    return res.status(500).json({ error: "Erro ao remover caixinha" });
  }
};
