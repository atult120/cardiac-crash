const calcomService = require("../services/calcomService");
const calendlyService = require("../services/calendlyService");

async function createSessions(req, res) {
  try {
    const created = await calcomService.createSessions(req.body);
    res.json({ success: true, data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function listSessions(req, res) {
  try {
    const { user_id } = req.query;
    const sessions = await calcomService.getSessions(user_id);
    res.json({ success: true, data: sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function getParticipants(req, res) {
  try {
    const participants = await calcomService.getParticipants(req.params.id);
    res.json({ success: true, data: participants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function getSessionById(req, res) {
  try {
    const session = await calcomService.getSessionById(req.params.id);
    res.json({ success: true, data: session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function updateSession(req, res) {
  try {
    const updated = await calcomService.updateSession(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function deleteSession(req, res) {
  try {
    await calcomService.deleteSession(req.params.id);
    res.json({ success: true, data: "Session deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createSessions,
  listSessions,
  getParticipants,
  getSessionById,
  updateSession,
  deleteSession,
};