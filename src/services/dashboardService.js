const db = require("../database/db");
const doceboService = require("./doceboService");

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function getDashboardData(query, token) {
    const {summary} = await doceboService.getCourses(query, token);
    const userId = query.user_id;
    
    const sessions = await db("sessions")
      .where({ docebo_user_id: userId })
      .select("id", "title", "description", "duration", "location");

    const sessionIds = sessions.map(s => s.id);
    const slots = await db("session_slots")
      .whereIn("session_id", sessionIds)
      .select("id", "session_id", "start_date", "end_date");

    // Total session count
    const totalSessions = sessions.length;

    // Upcoming sessions: session has at least one slot with start_date in future
    const now = new Date();
    const upcomingSessionIds = new Set(
      slots.filter(slot => slot.start_date && new Date(slot.start_date) > now)
           .map(slot => slot.session_id)
    );
    const upcomingSessions = sessions
      .filter(s => upcomingSessionIds.has(s.id))
      .map(s => ({
        ...s,
        slots: slots
          .filter(slot => slot.session_id === s.id && slot.start_date && new Date(slot.start_date) > now)
          .map(slot => ({
            ...slot,
            start_date: formatDate(slot.start_date),
            end_date: formatDate(slot.end_date)
          }))
      }));

    return {
        course: summary,
        sessions: {
            total: totalSessions,
            upcoming: upcomingSessions
        },
    };
}

module.exports = {
    getDashboardData
}
