const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const controller = require("../controllers/box.controller");

router.use(auth);
router.get("/", controller.list);
router.post("/:id/move", controller.move);

module.exports = router;
