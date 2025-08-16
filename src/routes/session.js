const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");

router.post("/", sessionController.createSessions);
router.get("/", sessionController.listSessions);
router.get("/:id/participants", sessionController.getParticipants);
router.get("/:id", sessionController.getSessionById);
router.put("/:id", sessionController.updateSession);
router.delete("/:id", sessionController.deleteSession); 

module.exports = router;