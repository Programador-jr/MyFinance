const connectDB = require("../config/database");

const Transaction = require("../models/Transaction");
const Category = require("../models/Category");

exports.list = async (req, res) => {
  try {
    await connectDB();

    const categories = await Category.find({
      $or: [
        { isFixed: true },
        { familyId: req.familyId }
      ]
    }).sort({ name: 1 });

    return res.json(categories);
  } catch (err) {
    console.error("CATEGORY LIST ERROR:", err);
    return res.status(500).json({ error: "Erro ao listar categorias" });
  }
};

exports.create = async (req, res) => {
  try {
    await connectDB();

    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    // Evita duplicidade por nome na mesma familia.
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

    return res.json(category);
  } catch (err) {
    console.error("CATEGORY CREATE ERROR:", err);
    return res.status(500).json({ error: "Erro ao criar categoria" });
  }
};

exports.update = async (req, res) => {
  try {
    await connectDB();

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

    return res.json(category);
  } catch (err) {
    console.error("CATEGORY UPDATE ERROR:", err);
    return res.status(500).json({ error: "Erro ao atualizar categoria" });
  }
};

exports.remove = async (req, res) => {
  try {
    await connectDB();

    const { id } = req.params;

    const category = await Category.findOne({
      _id: id,
      familyId: req.familyId,
      isFixed: false
    });

    if (!category) {
      return res.status(404).json({ error: "Categoria não encontrada" });
    }

    // Bloqueia exclusao se houver transacoes usando a categoria.
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
    return res.json({ success: true });
  } catch (err) {
    console.error("CATEGORY REMOVE ERROR:", err);
    return res.status(500).json({ error: "Erro ao remover categoria" });
  }
};
