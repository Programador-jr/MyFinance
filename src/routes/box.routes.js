const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const controller = require("../controllers/box.controller");

router.use(auth);

router.get("/", controller.list);
router.post("/", controller.create);
router.get("/market/cdi", controller.marketCdi);

router.post("/:id/move", controller.move);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
