const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const controller = require("../controllers/category.controller");

router.use(auth);

router.get("/", controller.list);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
