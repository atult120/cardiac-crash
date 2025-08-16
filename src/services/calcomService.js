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
    const results = [];
    const sessionsData = body.sessions;
    const userId = body.user_id;
  
    for (const session of sessionsData) {
      // 1. Create Schedule
      const schedulePayload = {
        name: `${session.title} Schedule`,
        availability: [
          {
            startDate: session.startDate,
            endDate: session.endDate,
            days: [1, 2, 3, 4, 5], // Mon-Fri default
            startTime: "09:00",
            endTime: "18:00"
          }
        ],
        timeZone: "Asia/Kolkata",
        isDefault: false
      };
  
      const scheduleRes = await this.makeAuthenticatedRequest(
        'post',
        `/v2/schedules`,
        schedulePayload
      );
  
      const scheduleId = scheduleRes.data.id;
  
      // 2. Create Event Type
      const eventTypePayload = {
        title: session.title,
        slug: generateSlug(session.title),
        description: session.description,
        length: session.length,
        scheduleId: scheduleId
      };
  
      const eventTypeRes = await this.makeAuthenticatedRequest(
        'post',
        `/v2/event-types`,
        eventTypePayload
      );
  
      const eventType = eventTypeRes.data;


      const username = 'atul-tiwari-lvo2sr';
  
      const bookingUrl = `https://cal.com/${username}/${eventType.slug}`;

  
      // 4. Save into merged "events" table
      await db("sessions").insert({
        title: session.title,
        slug: eventType.slug,
        description: session.description,
        start_date: session.startDate,
        end_date: session.endDate,
        cal_event_type_id: eventType.id,
        duration: session.length,
        docebo_user_id: userId,
        username: username,
        booking_url: bookingUrl,
      });
  
      // push both eventType + booking info
      results.push({
        ...eventType,
        booking_url: bookingUrl,
      });
    }
  
    return results;
  }

  // ------------------
  // 📌 Session Management
  // ------------------
  async getSessions(userId) {
    return db('sessions').where({ docebo_user_id: userId }).select('*');
  }

  async getSessionById(id) {
    return db('sessions').where({ id }).first();
  }

  async updateSession(id, updates) {
    const session = await db("sessions").where({ id }).first();
    if (!session) {
      throw new Error("Session not found");
    }

    console.log('session',session);
  
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
    delete updates.length;
    delete updates.startDate;
    delete updates.endDate;
  
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

module.exports = new CalcomService();