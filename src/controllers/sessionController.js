const calendlyService = require("../services/calendlyService");

async function createSessions(req, res) {
  try {
    const created = await calendlyService.createSessions(req.body);
    res.json({ success: true, data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function listSessions(req, res) {
  try {
    const { user_id } = req.query;
    const sessions = await calendlyService.getSessions(user_id);
    res.json({ success: true, data: sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function getParticipants(req, res) {
  try {
    const participants = await calendlyService.getParticipants(req.params.id);
    res.json({ success: true, data: participants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function getSessionById(req, res) {
  try {
    const session = await calendlyService.getSessionById(req.params.id);
    res.json({ success: true, data: session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function updateSession(req, res) {
  try {
    const updated = await calendlyService.updateSession(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function deleteSession(req, res) {
  try {
    await calendlyService.deleteSession(req.params.id);
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