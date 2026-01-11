const router = require("express").Router();
const controller = require("../controllers/auth.controller");

router.post("/register", controller.register);
router.post("/login", controller.login);

router.get("/verify-email", controller.verifyEmail);
router.post("/resend-verification", controller.resendVerification);


router.post("/forgot-password", controller.forgotPassword);
router.post("/reset-password", controller.resetPassword);

module.exports = router;

