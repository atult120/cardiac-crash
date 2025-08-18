const axios = require('axios');
const config = require('../config/config');
const { AppError } = require('../utils/errorHandler');
const db = require('../database/db');

class CalcomService {
  constructor() {
    this.client = axios.create({
      baseURL: config.calcom.baseUrl,
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
        console.error('Cal.com API error:', error.response?.data);
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
    const token = config.calcom.apiKey;
    console.log('token',token);
    
    const requestConfig = {
      method,
      url,
      headers: { Authorization: `Bearer ${token}` },
      'cal-api-version': "2024-06-14"
    };

    console.log('requestConfig',requestConfig);
    
    if (data) requestConfig.data = data;
    if (params) requestConfig.params = params;
    return this.client(requestConfig);
  }

  // ------------------
  // 📌 Bulk Create Sessions
  // ------------------
  async createSessions(body) {
    const { user_id, title, description, slug, length, slots } = body;
  
    // 1. Create Schedule with all slots as availability blocks
    const schedulePayload = {
      name: `${title} Schedule`,
      availability: slots.map(slot => ({
        startDate: slot.startDate,
        endDate: slot.endDate,
        days: [1, 2, 3, 4, 5], // or derive from slot if you want
        startTime: slot.startTime,
        endTime: slot.endTime
      })),
      timeZone: "Asia/Kolkata",
      isDefault: false
    };
  
    const scheduleRes = await this.makeAuthenticatedRequest(
      "post",
      `/v2/schedules`,
      schedulePayload
    );
    const scheduleId = scheduleRes.data.id;
  
    // 2. Create Event Type (one for all slots)
    const eventTypePayload = {
      title,
      slug: generateSlug(slug || title),
      description,
      length, // duration in minutes
      scheduleId
    };
  
    const eventTypeRes = await this.makeAuthenticatedRequest(
      "post",
      `/v2/event-types`,
      eventTypePayload
    );
    const eventType = eventTypeRes.data;
  
    // 3. Build booking URL
    const username = "atul-tiwari-lvo2sr"; // TODO: make dynamic per user
    const bookingUrl = `https://cal.com/${username}/${eventType.slug}`;
  
    // 4. Insert multiple session rows in DB (one per slot)
    const sessionRecords = slots.map(slot => ({
      title,
      slug: eventType.slug,
      description,
      start_date: slot.startDate,
      end_date: slot.endDate,
      start_time: slot.startTime,
      end_time: slot.endTime,
      cal_event_type_id: eventType.id,
      duration: length,
      docebo_user_id: user_id,
      username,
      booking_url: bookingUrl
    }));
  
    await db("sessions").insert(sessionRecords);
  
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
    // 1. Get sessions from DB
    const sessions = await db("sessions")
      .where({ docebo_user_id: userId })
      .select("*");
  
    if (sessions.length === 0) return [];
  
    const eventTypeIds = sessions.map(s => s.cal_event_type_id).join(",");
  
    const bookingsRes = await this.makeAuthenticatedRequest(
      "get",
      `/v2/bookings?take=100&eventTypeIds=${encodeURIComponent(eventTypeIds)}`
    );
  
    const bookings = bookingsRes.data.bookings;
  
    const bookingCounts = bookings.reduce((acc, b) => {
      const attendeeCount = b.attendees ? b.attendees.length : 0;      
      acc[b.eventType.id] = (acc[b.eventType.id] || 0) + attendeeCount;
      return acc;
    }, {});

    
  
    return sessions.map(session => ({
      ...session,
      total_participants: bookingCounts[session.cal_event_type_id] || 0,
      status: getSessionStatus(session)
    }));
  }

  async getSessionById(id) {
    return db('sessions').where({ id }).first();
  }

  async updateSession(id, updates) {
    const session = await db("sessions").where({ id }).first();
    if (!session) {
      throw new Error("Session not found");
    }
  
    const eventTypePayload = {};
    if (updates.title) eventTypePayload.title = updates.title;
    if (updates.description) eventTypePayload.description = updates.description;
    if (updates.length) eventTypePayload.length = updates.length;
    if (updates.slug) eventTypePayload.slug = updates.slug;
  
    if (Object.keys(eventTypePayload).length > 0) {
      await this.makeAuthenticatedRequest(
        "patch",
        `/v2/event-types/${session.cal_event_type_id}`,
        eventTypePayload
      );
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
  
    if (session.cal_event_type_id) {
      try {
        await this.makeAuthenticatedRequest(
          "delete",
          `/v2/event-types/${session.cal_event_type_id}`
        );
      } catch (err) {
        console.error("Error deleting Cal.com event type:", err.response?.data || err.message);
      }
    }
  
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
      throw new Error(`Session with id ${sessionId} not found`);
    }

    const eventTypeId = session.cal_event_type_id;

    const res = await this.makeAuthenticatedRequest(
      "get",
      `/v2/bookings?eventTypeId=${eventTypeId}`
    );

    const participants = [];
    for (const booking of res.data.bookings) {
      if (booking.attendees && booking.attendees.length > 0) {
        participants.push(...booking.attendees);
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


module.exports = new CalcomService();