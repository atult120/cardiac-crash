const axios = require('axios');
const config = require('../config/config');
const { AppError } = require('../utils/errorHandler');

class DoceboService {
  constructor() {
    this.client = axios.create({
      baseURL: config.docebo.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set up response handling
    this.setupResponseHandling();
  }

  setupResponseHandling() {
    // Response interceptor for error handling only
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        // Handle error messages
        console.error('Docebo API error:', error.response?.data);
        let message = error.message;
        if (error.response?.data?.error_description) {
            message = error.response.data.error_description;
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

  async getAccessToken() {
    try {
      // Create params for OAuth request
      const params = new URLSearchParams({
        client_id: config.docebo.clientId,
        client_secret: config.docebo.clientSecret,
        grant_type: 'password',
        username: config.docebo.username,
        password: config.docebo.password,
        scope: 'api',
      });

      console.log('OAuth request params:', params.toString());
      console.log('OAuth endpoint:', `${config.docebo.baseUrl}/oauth2/token`);

      // Make OAuth request
      const response = await axios.post(
        `${config.docebo.baseUrl}/oauth2/token`,
        params,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      console.log('OAuth response status:', response.status);
      console.log('OAuth response data:', JSON.stringify(response.data));

      // Return just the access token
      if (!response.data.access_token) {
        throw new Error('Invalid token response from OAuth server');
      }
      
      return response.data.access_token;
    } catch (error) {
      console.error('Failed to get access token:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw new AppError('Failed to get access token', 401);
    }
  }

  // New method for user login with username and password
  async loginUser(username, password) {
  try {
    // Create both token request parameter sets
    const userTokenParams = new URLSearchParams({
      client_id: config.docebo.clientId,
      client_secret: config.docebo.clientSecret,
      grant_type: 'password',
      username,
      password,
      scope: 'api',
    });

    const adminTokenParams = new URLSearchParams({
      client_id: config.docebo.clientId,
      client_secret: config.docebo.clientSecret,
      grant_type: 'password',
      username: config.docebo.username,
      password: config.docebo.password,
      scope: 'api',
    });

    const [userTokenRes, adminTokenRes] = await Promise.all([
      axios.post(`${config.docebo.baseUrl}/oauth2/token`, userTokenParams, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }),
      axios.post(`${config.docebo.baseUrl}/oauth2/token`, adminTokenParams, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
    ]);

    const userAccessToken = userTokenRes.data.access_token;
    const adminAccessToken = adminTokenRes.data.access_token;

    let userInfo = null;

    try {
      const userInfoRes = await axios.get(
        `${config.docebo.baseUrl}/api/manage/v1/user`,
        {
          params: { search_text: username },
          headers: { Authorization: `Bearer ${adminAccessToken}` }
        }
      );

      console.log('User info response:', userInfoRes.data);
      if (userInfoRes.data?.data?.items?.length > 0) {
        userInfo = userInfoRes.data.data.items[0];
      }
    } catch (e) {
      console.warn('⚠️ Could not fetch user info:', e.response?.data || e.message);
    }

    return {
      auth: {
        access_token: userAccessToken,
        ...userTokenRes.data
      },
      user: userInfo || null,
    };

  } catch (err) {
    console.error('❌ Login failed:', err.response?.data || err.message);
    throw new AppError('Authentication failed', 401);
  }
}

  // Helper method to make authenticated API calls
  async makeAuthenticatedRequest(method, url, data = null, params = null , token = null) {
    try {
      // Get fresh token for this request
      token = token || await this.getAccessToken();
      // Prepare request config
      const config = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };
      console.log('config',config);
      
      // Add data or params if provided
      if (data) config.data = data;
      if (params) config.params = params;
      console.log('configParams',params);
      
      // Make the request
      return this.client(config);
    } catch (error) {
      console.error(`Error in ${method} ${url}:`, error.message);
      throw error;
    }
  }

  // User Management
  async getAllUsers(params = {}) {
    return this.makeAuthenticatedRequest('get', '/manage/v1/user', null, params);
  }

  async createUser(userData) {
    return this.makeAuthenticatedRequest('post', '/manage/v1/user', userData);
  }

  async updateUser(userId, userData) {
    return this.makeAuthenticatedRequest('put', `/manage/v1/user/${userId}`, userData);
  }

  async deleteUser(userId) {
    return this.makeAuthenticatedRequest('delete', `/manage/v1/user/${userId}`);
  }

  async getUserEnrollments(userId) {
    return this.makeAuthenticatedRequest('get', `/learn/v1/enrollments`, null, { id_user: userId });
  }

  // Course Management
  async getCourses(params = {} , token) {
    const allCoursesRes = await this.makeAuthenticatedRequest('get', '/learn/v1/courses', null, {
      page_size: 100,
      sort_by: 'create_date',
      sort_by_direction: 'desc',
    } , token);
    const visibleCourses = allCoursesRes.data.items || [];

    const allEnrollmentsRes = await this.makeAuthenticatedRequest('get', '/learn/v1/enrollments', null, params , token);
    const visibleEnrollments = allEnrollmentsRes.data?.items || [];

    const enrolledList = visibleEnrollments || [];
    const enrolledMap = new Map(enrolledList.map(e => [e.uidCourse, e]));
    console.log('visibleCourses',visibleCourses);
    const enrolledCourses = visibleCourses
      .filter(course => enrolledMap.has(course.uidCourse))
      .map(course => {
        const enrollment = enrolledMap.get(course.uidCourse);
        return {
          course_id: course.id_course,
          title: course.name,
          description: course.description,
          status: enrollment.status,
          completed_on: enrollment.completed_on || null,
          last_access_date: enrollment.last_access_date || null
        };
      });

      // 📊 Calculate summary stats
const total_courses = enrolledCourses.length;
const total_completed = enrolledCourses.filter(c => c.completed_on !== null).length;
const total_in_progress = enrolledCourses.filter(c => c.status === 'in_progress').length;

  return {
    courses: enrolledCourses,
    summary: {
      total_courses,
      total_completed,
      total_in_progress,
    }
};
  }

  async getCourseById(courseId) {
    return this.makeAuthenticatedRequest('get', `/learn/v1/courses/${courseId}`);   
  }

  async enrollUserInCourse(enrollmentData) {
    return this.makeAuthenticatedRequest('post', '/learn/v1/enrollments', enrollmentData);
  }

  async refreshToken(refreshToken) {
    return await this.client.post('/oauth2/token', {
      client_id: config.docebo.clientId,
      client_secret: config.docebo.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'api',
    });
  }

  async getSdkUrl() {
    const resp = await this.makeAuthenticatedRequest('get', '/setup/v1/flow/settings');
    return resp.data;
  }
}

module.exports = new DoceboService();
