const axios = require('axios');
const config = require('../config/config');
const { AppError } = require('../utils/errorHandler');
const db = require('../database/db');

class CalendlyService {
  constructor() {
    this.client = axios.create({
      baseURL: config.calendly.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.setupResponseHandling();
  }

  setupResponseHandling() {
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        console.error('Calendly API error:', error.response?.data);
        let message = error.message;
        if (error.response?.data?.error) {
          message = error.response.data.error;
        } else if (error.response?.data?.message) {
          message = typeof error.response.data.message === 'object'
            ? JSON.stringify(error.response.data.message)
            : error.response.data.message;
        }
        const statusCode = error.response?.status || 500;
        throw new AppError(message, statusCode);
      }
    );
  }

  async makeAuthenticatedRequest(method, url, data = null, params = null) {
    const token = config.calendly.apiKey;
    if (!token) {
      throw new AppError('Calendly API key not found', 500);
    }
    const requestConfig = {
      method,
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        "cal-api-version": "2024-06-14"
      }
    };
    
    if (data) requestConfig.data = data;
    if (params) requestConfig.params = params;
    return this.client(requestConfig);
  }

  // ------------------
  // 📌 Bulk Create Sessions
  // ------------------
  getWeekdaysBetween(startDateStr, endDateStr) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
  
    const weekdays = new Set();
  
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      weekdays.add(days[d.getDay()]);
    }
  
    return Array.from(weekdays);
  }

  async createSessions(body) {
    const { user_id, title, description, slug, length, slots } = body;
  
    const eventTypePayload = {
      owner: "https://api.calendly.com/users/1ee617bc-c1fe-4962-ae0e-6c55487954bd",
      name: title,
      duration: length,
      description,
      active: true
    };
  
    const eventTypeRes = await this.makeAuthenticatedRequest(
      "post",
      "/event_types",
      eventTypePayload
    );
  
    const eventType = eventTypeRes.resource;
    const uri = eventType.uri;
    const bookingUrl = eventType.scheduling_url;

    const rules = body.slots.map(slot => ({
      type: "date",
      date: slot.startDate,
      intervals: [
        { from: slot.startTime, to: slot.endTime }
      ]
    }));
    const scheduleBody = {
      availability_setting: "host",
      availability_rule: {
        timezone: "Asia/Kolkata",
        rules: rules
      }
    };
     await this.makeAuthenticatedRequest(
      "patch",
      `/event_type_availability_schedules?event_type=${encodeURIComponent(uri)}`,
      scheduleBody
    );
  
    // Extract UUID from the URI
    const uuidMatch = uri.match(/event_types\/([\w-]+)/);
    const calEventTypeId = uuidMatch ? uuidMatch[1] : uri;
  
    // Insert session record (single row)
    const [sessionId] = await db("sessions").insert({
      title,
      slug: eventType.slug,
      description,
      cal_event_type_id: calEventTypeId,
      duration: length,
      docebo_user_id: user_id,
      username: 'ixltech.atul',
      booking_url: bookingUrl
    }).returning('id');
  
    // Insert slots into session_slots table
    const slotRecords = slots.map(slot => ({
      session_id: sessionId,
      start_date: slot.startDate,
      end_date: slot.endDate,
      start_time: slot.startTime,
      end_time: slot.endTime
    }));
    await db("session_slots").insert(slotRecords);
  
    return {
      ...eventType,
      booking_url: bookingUrl,
      slots
    };
  }
  // ------------------
  // 📌 Session Management
  // ------------------
  async getSessions(userId) {
  // 1. Get all sessions from your database for the given user.
    const sessions = await db("sessions")
      .where({ docebo_user_id: userId })
      .select("*");

    if (sessions.length === 0) {
      return [];
    }

    // Fetch slots for all sessions in one query
    const sessionIds = sessions.map(s => s.id);
    const allSlots = await db("session_slots").whereIn("session_id", sessionIds);
    const slotsBySession = {};
    allSlots.forEach(slot => {
      if (!slotsBySession[slot.session_id]) slotsBySession[slot.session_id] = [];
      slotsBySession[slot.session_id].push(slot);
    });

    // Map sessions by their Calendly event type ID for easy lookup.
    const sessionsMap = new Map(sessions.map(s => [s.cal_event_type_id, s]));

    const userRes = await this.makeAuthenticatedRequest("get", "/users/me");
    const userUri = userRes.resource.uri;
    const allEventsRes = await this.makeAuthenticatedRequest(
      "get",
      `/scheduled_events?user=${encodeURIComponent(userUri)}`
    );

    const scheduledEvents = allEventsRes.collection || [];
    const eventParticipantCounts = new Map();

    for (const event of scheduledEvents) {
      const eventTypeUri = event.event_type;
      const eventUuid = event.uri.split('/').pop();
      const eventTypeId = eventTypeUri.split('/').pop();

      if (sessionsMap.has(eventTypeId)) {
        const inviteesRes = await this.makeAuthenticatedRequest(
          "get",
          `/scheduled_events/${eventUuid}/invitees`
        );
        const invitees = inviteesRes.collection || [];
        const attendeeCount = invitees.length;
        eventParticipantCounts.set(
          eventTypeId,
          (eventParticipantCounts.get(eventTypeId) || 0) + attendeeCount
        );
      }
    }

    // Merge participant counts and slots into sessions
    const sessionsWithCountsAndSlots = sessions.map(session => ({
      ...session,
      participants: eventParticipantCounts.get(session.cal_event_type_id) || 0,
      slots: slotsBySession[session.id] || []
    }));

    return sessionsWithCountsAndSlots;
}

  async getSessionById(id) {
    const session = await db('sessions').where({ id }).first();
    if (!session) return null;
    const slots = await db('session_slots').where({ session_id: id });
    return { ...session, slots };
  }

  async updateSession(id, updates) {
    const session = await db("sessions").where({ id }).first();
    if (!session) {
      throw new Error("Session not found");
    }

    const eventTypePayload = {};
    if (updates.title) eventTypePayload.name = updates.title;
    if (updates.description) eventTypePayload.description = updates.description;
    if (updates.length) eventTypePayload.lengthInMinutes = updates.length;
    if (updates.slug) eventTypePayload.slug = session.slug;

    if (Object.keys(eventTypePayload).length > 0) {
      await this.makeAuthenticatedRequest(
        "patch",
        `/event_types/${session.cal_event_type_id}`,
        eventTypePayload
      );
    }
            console.log('session', session);



    // Add this block to update the availability schedule
    if (updates.slots && updates.slots.length > 0) {
      const rules = updates.slots.map(slot => ({
        type: "date",
        date: slot.startDate,
        intervals: [
          { from: slot.startTime, to: slot.endTime }
        ]
      }));
      const scheduleBody = {
        availability_setting: "host",
        availability_rule: {
          timezone: "Asia/Kolkata",
          rules: rules
        }
      };
      await this.makeAuthenticatedRequest(
        "patch",
        `/event_type_availability_schedules?event_type=${encodeURIComponent(`https://api.calendly.com/event_types/${session.cal_event_type_id}`)}`,
        scheduleBody
      );

      // Update session_slots table: delete old slots and insert new ones
      await db("session_slots").where({ session_id: id }).del();
      const slotRecords = updates.slots.map(slot => ({
        session_id: id,
        start_date: slot.startDate,
        end_date: slot.endDate,
        start_time: slot.startTime,
        end_time: slot.endTime
      }));
      await db("session_slots").insert(slotRecords);
    }

    updates.duration = updates.length;
    updates.start_date = updates.startDate;
    updates.end_date = updates.endDate;
    updates.start_time = updates.startTime;
    updates.end_time = updates.endTime;
    delete updates.user_id;
    delete updates.length;
    delete updates.startDate;
    delete updates.endDate;
    delete updates.startTime;
    delete updates.endTime;
    delete updates.slots;

    await db("sessions").where({ id }).update(updates);

    return this.getSessionById(id);
}

  async deleteSession(id) {
    const session = await db("sessions").where({ id }).first();
    if (!session) {
      throw new Error("Session not found");
    }

    // Delete all slots for this session
    await db("session_slots").where({ session_id: id }).del();

    await db("sessions").where({ id }).del();
    return true;
}

  // ------------------
  // 📌 Participants
  // ------------------
  async getParticipants(sessionId) {
     const session = await db("sessions")
      .where({ id: sessionId })
      .first("cal_event_type_id");

    if (!session) {
      // If no session is found, we can't proceed. Throw an error.
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    const eventTypeId = session.cal_event_type_id;

    // 2. Build the full event type URI as required by the Calendly API.
    const eventTypeUri = `https://api.calendly.com/event_types/${eventTypeId}`;

    // 3. First API Call: Get all scheduled events for this specific event type.
    // The Calendly API doesn't have a direct 'bookings' endpoint; you first
    // have to find all the individual events that were booked from this type.
     const userRes = await this.makeAuthenticatedRequest("get", "/users/me");
    const userUri = userRes.resource.uri;
    const scheduledEventsRes = await this.makeAuthenticatedRequest(
      "get",
      `/scheduled_events?user=${encodeURIComponent(userUri)}`
    );

    const scheduledEvents = scheduledEventsRes.collection || [];
    const participants = [];

    // 4. Loop through each scheduled event to get its invitees (participants).
    // This second API call is necessary for each event to get the invitee details.
    for (const event of scheduledEvents) {
      // Extract the UUID of the scheduled event from its URI.
      const eventUuidMatch = event.uri.match(/scheduled_events\/([\w-]+)/);
      const eventUuid = eventUuidMatch ? eventUuidMatch[1] : null;
      const eventTypeUri = event.event_type;
      const apiEventTypeId = eventTypeUri.split('/').pop();

      if (eventTypeId === apiEventTypeId) {
        const inviteesRes = await this.makeAuthenticatedRequest(
          "get",
          `/scheduled_events/${eventUuid}/invitees`
        );

        // Add the invitees to our list.
        if (inviteesRes && inviteesRes.collection) {
          const simplifiedParticipants = inviteesRes.collection.map(invitee => ({
            name: invitee.name,
            email: invitee.email
          }));
          participants.push(...simplifiedParticipants);
        }
      }

    }
    return participants;

  }

  async addParticipant(sessionId, participantData) {
    return this.makeAuthenticatedRequest(
      'post',
      `/v2/sessions/${sessionId}/participants`,
      participantData
    );
  }
}
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') 
    .replace(/(^-|-$)+/g, '') 
    + '-' + Date.now();            
}

function getSessionStatus(session) {
  const now = new Date();
  const start = new Date(session.start_date);
  const end = new Date(session.end_date);

  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "ongoing";
  return "completed";
}


module.exports = new CalendlyService();
