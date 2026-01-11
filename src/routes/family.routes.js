const router = require("express").Router();
const controller = require("../controllers/family.controller");
const auth = require("../middlewares/auth.middleware");
const isOwner = require("../middlewares/isFamilyOwner.middleware");

router.post("/join", auth, controller.joinFamily);
router.post("/invite-code", auth, controller.regenerateInviteCode);
router.get("/invite-code", auth, isOwner, controller.getInviteCode);
router.patch("/invite-code", auth, isOwner, controller.regenerateInviteCode);
router.get("/", auth, controller.getFamily);

module.exports = router;
