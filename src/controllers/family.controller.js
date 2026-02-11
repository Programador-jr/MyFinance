const crypto = require("crypto");
const Family = require("../models/Family");
const User = require("../models/User");

function normalizeRoleValue(value) {
  const role = String(value || "").trim().toLowerCase();
  return ["owner", "admin", "member"].includes(role) ? role : "";
}

function getOwnerId(family) {
  return String(family?.ownerId?._id || family?.ownerId || "");
}

function isValidMongoId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || "").trim());
}

function resolveFamilyRole(user, family) {
  if (!user || !family) return "member";

  const ownerId = getOwnerId(family);
  const userId = String(user._id || user.id || "");
  if (userId && userId === ownerId) return "owner";

  const stored = normalizeRoleValue(user.familyRole);
  if (stored === "admin") return "admin";
  return "member";
}

function toFamilyPayload(family) {
  if (!family) return null;

  const owner = family.ownerId || null;

  return {
    id: family._id,
    name: family.name,
    createdAt: family.createdAt,
    ownerId: owner
      ? {
          id: owner._id || owner.id || owner,
          name: owner.name || "",
          email: owner.email || "",
        }
      : null,
  };
}

function toMemberPayload(member, family) {
  const role = resolveFamilyRole(member, family);

  return {
    id: member._id,
    name: member.name,
    email: member.email,
    createdAt: member.createdAt,
    familyRole: role,
    isOwner: role === "owner",
  };
}

function sortMembers(members) {
  const roleOrder = { owner: 0, admin: 1, member: 2 };

  return [...members].sort((a, b) => {
    const roleA = roleOrder[a.familyRole] ?? 99;
    const roleB = roleOrder[b.familyRole] ?? 99;
    if (roleA !== roleB) return roleA - roleB;

    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    if (dateA !== dateB) return dateA - dateB;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function getPermissions(role) {
  const isOwner = role === "owner";
  const isAdmin = role === "admin";

  return {
    canManageFamily: isOwner || isAdmin,
    canManageMembers: isOwner || isAdmin,
    canAssignAdmin: isOwner,
    canTransferOwnership: isOwner,
    canLeaveFamily: !isOwner,
  };
}

async function loadActorAndFamily(userId) {
  const actor = await User.findById(userId);
  if (!actor) {
    return { error: { code: 404, message: "Usuario nao encontrado" } };
  }

  if (!actor.familyId) {
    return { actor, family: null };
  }

  const family = await Family.findById(actor.familyId).populate("ownerId", "name email");
  if (!family) {
    actor.familyId = null;
    actor.familyRole = "member";
    await actor.save();
    return { actor, family: null };
  }

  const actorRole = resolveFamilyRole(actor, family);
  if (actor.familyRole !== actorRole) {
    actor.familyRole = actorRole;
    await actor.save();
  }

  return { actor, family, actorRole };
}

async function loadMemberFromFamily(familyId, memberId) {
  return User.findOne(
    { _id: memberId, familyId },
    "name email createdAt familyId familyRole"
  );
}

exports.joinFamily = async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const userId = req.userId;

    if (!code) {
      return res.status(400).json({ error: "Codigo de convite e obrigatorio" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuario nao encontrado" });
    }

    if (user.familyId) {
      const currentFamily = await Family.exists({ _id: user.familyId });
      if (currentFamily) {
        return res.status(400).json({ error: "Usuario ja pertence a uma familia" });
      }

      // Corrige vinculo antigo quebrado antes de entrar em uma nova familia.
      user.familyId = null;
      user.familyRole = "member";
      await user.save();
    }

    const family = await Family.findOne({ inviteCode: code });
    if (!family) {
      return res.status(400).json({ error: "Codigo invalido" });
    }

    user.familyId = family._id;
    user.familyRole = "member";
    await user.save();

    return res.json({
      message: "Entrou na familia com sucesso",
      familyId: family._id,
      familyRole: "member",
    });
  } catch (err) {
    console.error("Join family error:", err);
    return res.status(500).json({ error: "Erro ao entrar na familia" });
  }
};

exports.getFamily = async (req, res) => {
  try {
    const loaded = await loadActorAndFamily(req.userId);
    if (loaded.error) {
      return res.status(loaded.error.code).json({ error: loaded.error.message });
    }

    const { family, actorRole = "member" } = loaded;
    if (!family) {
      return res.status(404).json({ error: "Familia nao encontrada" });
    }

    const membersDocs = await User.find(
      { familyId: family._id },
      "name email createdAt familyRole"
    );

    const members = sortMembers(
      membersDocs.map((member) => toMemberPayload(member, family))
    );

    return res.json({
      family: toFamilyPayload(family),
      members,
      currentUserRole: actorRole,
      permissions: getPermissions(actorRole),
    });
  } catch (err) {
    console.error("Get family error:", err);
    return res.status(500).json({ error: "Erro ao buscar familia" });
  }
};

exports.getInviteCode = async (req, res) => {
  try {
    return res.json({ inviteCode: req.family.inviteCode });
  } catch (err) {
    console.error("Get invite code error:", err);
    return res.status(500).json({ error: "Erro ao obter codigo" });
  }
};

exports.regenerateInviteCode = async (req, res) => {
  try {
    req.family.inviteCode = crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase();

    await req.family.save();

    return res.json({
      message: "Codigo regenerado",
      inviteCode: req.family.inviteCode,
    });
  } catch (err) {
    console.error("Regenerate invite code error:", err);
    return res.status(500).json({ error: "Erro ao regenerar codigo" });
  }
};

exports.updateFamilyName = async (req, res) => {
  try {
    const loaded = await loadActorAndFamily(req.userId);
    if (loaded.error) {
      return res.status(loaded.error.code).json({ error: loaded.error.message });
    }

    const { family, actorRole = "member" } = loaded;
    if (!family) {
      return res.status(404).json({ error: "Familia nao encontrada" });
    }

    if (!["owner", "admin"].includes(actorRole)) {
      return res.status(403).json({ error: "Apenas owner ou admin pode alterar o nome da familia" });
    }

    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Nome da familia e obrigatorio" });
    }
    if (name.length < 2) {
      return res.status(400).json({ error: "Nome da familia muito curto" });
    }
    if (name.length > 80) {
      return res.status(400).json({ error: "Nome da familia muito longo" });
    }

    family.name = name;
    await family.save();

    return res.json({
      message: "Nome da familia atualizado",
      family: toFamilyPayload(family),
    });
  } catch (err) {
    console.error("Update family name error:", err);
    return res.status(500).json({ error: "Erro ao atualizar nome da familia" });
  }
};

exports.updateMemberRole = async (req, res) => {
  try {
    const loaded = await loadActorAndFamily(req.userId);
    if (loaded.error) {
      return res.status(loaded.error.code).json({ error: loaded.error.message });
    }

    const { actor, family, actorRole = "member" } = loaded;
    if (!family) {
      return res.status(404).json({ error: "Familia nao encontrada" });
    }

    if (actorRole !== "owner") {
      return res.status(403).json({ error: "Apenas o owner pode alterar papeis de membros" });
    }

    const memberId = String(req.params?.memberId || "").trim();
    const desiredRole = normalizeRoleValue(req.body?.role);

    if (!["admin", "member"].includes(desiredRole)) {
      return res.status(400).json({ error: "Papel invalido. Use admin ou member" });
    }

    if (!memberId || !isValidMongoId(memberId)) {
      return res.status(400).json({ error: "Membro invalido" });
    }

    const member = await loadMemberFromFamily(family._id, memberId);
    if (!member) {
      return res.status(404).json({ error: "Membro nao encontrado na familia" });
    }

    if (String(member._id) === String(actor._id)) {
      return res.status(400).json({ error: "Nao e possivel alterar o proprio papel" });
    }

    const memberRole = resolveFamilyRole(member, family);
    if (memberRole === "owner") {
      return res.status(400).json({ error: "Nao e possivel alterar o papel do owner" });
    }

    member.familyRole = desiredRole;
    await member.save();

    return res.json({
      message: desiredRole === "admin" ? "Membro promovido para admin" : "Membro definido como membro comum",
      member: toMemberPayload(member, family),
    });
  } catch (err) {
    console.error("Update member role error:", err);
    return res.status(500).json({ error: "Erro ao alterar papel do membro" });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const loaded = await loadActorAndFamily(req.userId);
    if (loaded.error) {
      return res.status(loaded.error.code).json({ error: loaded.error.message });
    }

    const { actor, family, actorRole = "member" } = loaded;
    if (!family) {
      return res.status(404).json({ error: "Familia nao encontrada" });
    }

    if (!["owner", "admin"].includes(actorRole)) {
      return res.status(403).json({ error: "Apenas owner ou admin pode remover membros" });
    }

    const memberId = String(req.params?.memberId || "").trim();
    if (!memberId || !isValidMongoId(memberId)) {
      return res.status(400).json({ error: "Membro invalido" });
    }

    const member = await loadMemberFromFamily(family._id, memberId);
    if (!member) {
      return res.status(404).json({ error: "Membro nao encontrado na familia" });
    }

    if (String(member._id) === String(actor._id)) {
      return res.status(400).json({ error: "Use a rota de sair da familia para remover sua propria conta" });
    }

    const memberRole = resolveFamilyRole(member, family);
    if (memberRole === "owner") {
      return res.status(400).json({ error: "Nao e possivel remover o owner da familia" });
    }

    if (actorRole === "admin" && memberRole !== "member") {
      return res.status(403).json({ error: "Admin nao pode remover outro admin" });
    }

    member.familyId = null;
    member.familyRole = "member";
    await member.save();

    return res.json({
      message: "Membro removido da familia",
      member: {
        id: member._id,
        name: member.name,
      },
    });
  } catch (err) {
    console.error("Remove member error:", err);
    return res.status(500).json({ error: "Erro ao remover membro da familia" });
  }
};

exports.leaveFamily = async (req, res) => {
  try {
    const loaded = await loadActorAndFamily(req.userId);
    if (loaded.error) {
      return res.status(loaded.error.code).json({ error: loaded.error.message });
    }

    const { actor, family, actorRole = "member" } = loaded;
    if (!family) {
      return res.status(404).json({ error: "Familia nao encontrada" });
    }

    if (actorRole === "owner") {
      return res.status(400).json({
        error: "Owner nao pode sair da familia sem antes transferir ownership",
      });
    }

    actor.familyId = null;
    actor.familyRole = "member";
    await actor.save();

    return res.json({ message: "Voce saiu da familia com sucesso" });
  } catch (err) {
    console.error("Leave family error:", err);
    return res.status(500).json({ error: "Erro ao sair da familia" });
  }
};

exports.transferOwnership = async (req, res) => {
  try {
    const loaded = await loadActorAndFamily(req.userId);
    if (loaded.error) {
      return res.status(loaded.error.code).json({ error: loaded.error.message });
    }

    const { actor, family, actorRole = "member" } = loaded;
    if (!family) {
      return res.status(404).json({ error: "Familia nao encontrada" });
    }

    if (actorRole !== "owner") {
      return res.status(403).json({ error: "Apenas owner pode transferir ownership" });
    }

    const targetMemberId = String(req.body?.memberId || "").trim();
    if (!targetMemberId || !isValidMongoId(targetMemberId)) {
      return res.status(400).json({ error: "Membro destino e obrigatorio" });
    }

    if (targetMemberId === String(actor._id)) {
      return res.status(400).json({ error: "Escolha outro membro para transferir ownership" });
    }

    const target = await loadMemberFromFamily(family._id, targetMemberId);
    if (!target) {
      return res.status(404).json({ error: "Membro nao encontrado na familia" });
    }

    family.ownerId = target._id;
    await family.save();

    actor.familyRole = "admin";
    target.familyRole = "owner";

    await Promise.all([actor.save(), target.save()]);

    const refreshedFamily = await Family.findById(family._id).populate("ownerId", "name email");

    return res.json({
      message: "Ownership transferido com sucesso",
      family: toFamilyPayload(refreshedFamily),
      previousOwner: { id: actor._id, name: actor.name },
      newOwner: { id: target._id, name: target.name },
    });
  } catch (err) {
    console.error("Transfer ownership error:", err);
    return res.status(500).json({ error: "Erro ao transferir ownership" });
  }
};
