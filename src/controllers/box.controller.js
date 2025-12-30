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
