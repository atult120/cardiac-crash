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

    // 1. Convert slots into availability blocks with weekdays
    const availability = slots.map(slot => ({
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday" , "Saturday"  , "Sunday"],
      startTime: slot.startTime,
      endTime: slot.endTime
    }));

    const overrides = slots.map(slot => ({
      date: slot.startDate,
      startTime: slot.startTime,
      endTime: slot.endTime
    }));

    // 2. Create schedule in Cal.com
    const schedulePayload = {
      name: `${title} Schedule`,
      availability,
      timeZone: "Asia/Kolkata",
      isDefault: false
    };

    console.log("Schedule payload:", schedulePayload);

    const scheduleRes = await this.makeAuthenticatedRequest(
      "post",
      "/v2/schedules",
      schedulePayload
    );
    const scheduleId = scheduleRes.data.id;

    // 3. Create Event Type (single for all slots)
    const eventTypePayload = {
      title,
      slug: generateSlug(slug || title),
      description,
      lengthInMinutes: length,
      seats: {
        seatsPerTimeSlot: 100,
        showAttendeeInfo : true,
        showAvailabilityCount : true
      },
      scheduleId,
      locations: [
         {
          type: "integration",
          integration: "google-meet",
          label: "Google Meet"
        }
      ],
    };

    const eventTypeRes = await this.makeAuthenticatedRequest(
      "post",
      "/v2/event-types",
      eventTypePayload
    );
    const eventType = eventTypeRes.data;
    console.log("Event type:", eventType.id);

    // 4. Build booking URL
    const username = "atul-tiwari-lvo2sr"; // TODO: make dynamic per user
    const bookingUrl = `https://cal.com/${username}/${eventType.slug}`;
    console.log("Booking URL:", bookingUrl);

    // 5. Insert multiple session rows in DB (one per slot)
    const sessionRecords = {
      title,
      slug: eventType.slug,
      description,
      cal_event_type_id: eventType.id,
      duration: length,
      docebo_user_id: user_id,
      username,
      booking_url: bookingUrl
    };

    const insertedSessionIds = await db('sessions').insert(sessionRecords);
    console.log("Inserted session IDs:", insertedSessionIds[0]);
    const slotRecords = slots.map((slot, idx) => ({
      session_id: insertedSessionIds[0],
      start_date: slot.startDate,
      end_date: slot.endDate,
      start_time: slot.startTime,
      end_time: slot.endTime
    }));
    await db('session_slots').insert(slotRecords);

    return {
      ...eventType,
      booking_url: bookingUrl,
      slots
    };
  }

  // async createSessions(body) {
  //   const { user_id, title, description, slug, length, slots } = body;
  
  //   const eventTypePayload = {
  //     owner: "https://api.calendly.com/users/1ee617bc-c1fe-4962-ae0e-6c55487954bd",
  //     name: title,
  //     duration: length,
  //     description,
  //     active: true
  //   };
  
  //   const eventTypeRes = await axios.post(
  //     "https://api.calendly.com/event_types",
  //     eventTypePayload,
  //     { headers: { Authorization: `Bearer ${config.calendely.apiKey}` } }
  //   );
  
  //   const eventType = eventTypeRes.data.resource;
  //   const uri = eventType.uri;
  
  //   const bookingUrl = eventType.scheduling_url;

  //   const rules = body.slots.map(slot => ({
  //     type: "date",
  //     date: slot.startDate, // single-day restriction
  //     intervals: [
  //       { from: slot.startTime, to: slot.endTime }
  //     ]
  //   }));

  //   console.log(rules)


  //   const scheduleBody = {
  //     availability_setting: "host",
  //     availability_rule: {
  //       timezone: "Asia/Kolkata",
  //       rules: rules
  //     }
  //   };


  //   // Send to Calendly
  //   const response = await axios.patch(
  //     `https://api.calendly.com/event_type_availability_schedules?event_type=${uri}`,
  //     scheduleBody,
  //     {
  //       headers: {
  //         Authorization: `Bearer ${config.calendely.apiKey}`,
  //         "Content-Type": "application/json"
  //       }
  //     }
  //   );
  
  //   const sessionRecords = [];
  
  //   for (const slot of slots) {
  //     sessionRecords.push({
  //       title,
  //       slug: eventType.slug,
  //       description,
  //       start_date: slot.startDate,
  //       end_date: slot.endDate,
  //       start_time: slot.startTime,
  //       end_time: slot.endTime,
  //       cal_event_type_id: "12",
  //       duration: length,
  //       docebo_user_id: user_id,
  //       username: 'ixltech.atul',
  //       booking_url: bookingUrl
  //     });
  //   }
  
  //   await db("sessions").insert(sessionRecords);
  
  //   return {
  //     ...eventType,
  //     booking_url: bookingUrl,
  //     slots
  //   };
  // }
  // ------------------
  // 📌 Session Management
  // ------------------
  async getSessions(userId) {
    // 1. Get sessions from DB
    const sessions = await db("sessions")
      .where({ docebo_user_id: userId })
      .select("*");
  
    if (sessions.length === 0) return [];
  
    // 2. Get all slots for these sessions
    const sessionIds = sessions.map(s => s.id);
    const slots = await db("session_slots")
      .whereIn("session_id", sessionIds)
      .select("*");
  
    // 3. Group slots by session_id
    const slotsBySession = {};
    for (const slot of slots) {
      if (!slotsBySession[slot.session_id]) slotsBySession[slot.session_id] = [];
      slotsBySession[slot.session_id].push(slot);
    }
  
    // 4. Get participant counts
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
  
    // 5. Merge slots into sessions
    return sessions.map(session => ({
      ...session,
      slots: slotsBySession[session.id] || [],
      total_participants: bookingCounts[session.cal_event_type_id] || 0,
      status: getSessionStatus(session)
    }));
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
    if (updates.title) eventTypePayload.title = updates.title;
    if (updates.description) eventTypePayload.description = updates.description;
    if (updates.length) eventTypePayload.lengthInMinutes = updates.length;
    if (updates.slug) eventTypePayload.slug = session.slug;
  
    if (Object.keys(eventTypePayload).length > 0) {
      await this.makeAuthenticatedRequest(
        "patch",
        `/v2/event-types/${session.cal_event_type_id}`,
        eventTypePayload
      );
    }

    updates.duration = updates.length;
   
    delete updates.user_id;
    delete updates.length;
    delete updates.startDate;
    delete updates.endDate;
    delete updates.startTime;
    delete updates.endTime;
    delete updates.slots;
  
    await db("sessions").where({ id }).update(updates);

     if (updates.slots && updates.slots.length > 0) {
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
      throw new Error(`Session with id ${sessionId} not found`);
    }

    const eventTypeId = session.cal_event_type_id;

    // const res = await this.makeAuthenticatedRequest(
    //   "get",
    //   `/v2/bookings?take=100&eventTypeId=${eventTypeId}`
    // );
    // console.log("EventTypeId used:", eventTypeId);
    // console.log("Raw API response:", JSON.stringify(res.data, null, 2));

    const url = `${config.calcom.baseUrl}/v2/bookings?take=100&eventTypeId=${eventTypeId}`;

    const options = {
      method: "GET",
      url,
      headers: {
        Authorization: config.calcom.apiKey,
        "cal-api-version": "2024-08-13",
      },
    };

    const res = await axios(options);

    console.log(res.data.data);
    const bookings = res.data.data;
    const participants = [];
    if(bookings){
      for (const booking of bookings) {
        if (booking.attendees && booking.attendees.length > 0) {
          participants.push(...booking.attendees);
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


module.exports = new CalcomService();