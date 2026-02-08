const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const controller = require("../controllers/account.controller");

router.use(auth);

router.post("/", controller.create);
router.get("/", controller.list);

router.post("/:id/pay", controller.pay);
router.get("/:id", controller.getById);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
