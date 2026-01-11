const Transaction = require("../models/Transaction");
const Category = require("../models/category");

/* ===============================
   LISTAR CATEGORIAS
================================ */
exports.list = async (req, res) => {
  const categories = await Category.find({
    $or: [
      { isFixed: true },
      { familyId: req.familyId }
    ]
  }).sort({ name: 1 });

  res.json(categories);
};

/* ===============================
   CRIAR CATEGORIA
================================ */
exports.create = async (req, res) => {
  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const exists = await Category.findOne({
    name: new RegExp(`^${name}$`, "i"),
    $or: [
      { isFixed: true },
      { familyId: req.familyId }
    ]
  });

  if (exists) {
    return res.status(400).json({ error: "Categoria já existe" });
  }

  const category = await Category.create({
    name,
    type,
    familyId: req.familyId,
    isFixed: false
  });

  res.json(category);
};

/* ===============================
   EDITAR CATEGORIA
================================ */
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const category = await Category.findOne({
    _id: id,
    familyId: req.familyId,
    isFixed: false
  });

  if (!category) {
    return res.status(404).json({ error: "Categoria não encontrada" });
  }

  category.name = name;
  await category.save();

  res.json(category);
};

/* ===============================
   EXCLUIR CATEGORIA
================================ */
exports.remove = async (req, res) => {
  const { id } = req.params;

  const category = await Category.findOne({
    _id: id,
    familyId: req.familyId,
    isFixed: false
  });

  if (!category) {
    return res.status(404).json({ error: "Categoria não encontrada" });
  }

  const inUse = await Transaction.exists({
    familyId: req.familyId,
    category: category.name
  });

  if (inUse) {
    return res.status(400).json({
      error: "Categoria em uso"
    });
  }

  await category.deleteOne();
  res.json({ success: true });
};
