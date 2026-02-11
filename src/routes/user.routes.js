const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const upload = require("../middlewares/uploadAvatar.middleware");
const controller = require("../controllers/user.controller");

router.get("/me", auth, controller.getMe);
router.patch("/me/avatar", auth, upload.single("avatar"), controller.uploadAvatar);
router.patch("/me", auth, controller.updateMe);
router.patch("/me/password", auth, controller.changePassword);
router.delete("/me", auth, controller.deleteMe);

module.exports = router;
