const router = require("express").Router();
const controller = require("../controllers/family.controller");
const auth = require("../middlewares/auth.middleware");
const isOwner = require("../middlewares/isFamilyOwner.middleware");

router.post("/join", auth, controller.joinFamily);
router.post("/invite-code", auth, isOwner, controller.regenerateInviteCode);
router.get("/invite-code", auth, isOwner, controller.getInviteCode);
router.patch("/invite-code", auth, isOwner, controller.regenerateInviteCode);
router.get("/", auth, controller.getFamily);
router.patch("/name", auth, controller.updateFamilyName);
router.patch("/members/:memberId/role", auth, controller.updateMemberRole);
router.delete("/members/:memberId", auth, controller.removeMember);
router.post("/leave", auth, controller.leaveFamily);
router.patch("/owner", auth, controller.transferOwnership);

module.exports = router;
