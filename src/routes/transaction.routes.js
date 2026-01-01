const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const controller = require("../controllers/transaction.controller");

router.use(auth);

router.post("/", controller.create);
router.get("/", controller.list);

/* FILTROS */
router.get("/month", controller.byMonth);
router.get("/year", controller.byYear);
router.get("/range", controller.byRange);

router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
