const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const upload = require("../middlewares/uploadAvatar.middleware");
const controller = require("../controllers/user.controller");

router.patch("/me/avatar", auth, upload.single("avatar"), controller.uploadAvatar);
router.patch("/me", auth, controller.updateMe);

module.exports = router;
