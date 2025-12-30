const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const controller = require("../controllers/transaction.controller");

router.use(auth);
router.post("/", controller.create);
router.get("/", controller.list);

module.exports = router;
