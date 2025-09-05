const axios = require('axios');
const crypto = require('crypto');
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

      // Make OAuth request
      const response = await axios.post(
        `${config.docebo.baseUrl}/oauth2/token`,
        params,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );


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
          params: { search_text: encodeURIComponent(username) },
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
      // Add data or params if provided
      if (data) config.data = data;
      if (params) config.params = params;
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
    const total_completed = enrolledCourses.filter(c => c.status === 'completed').length;
    const total_in_progress = enrolledCourses.filter(c => c.status === 'in_progress').length;

    const onboardingCourses = enrolledCourses.filter(c => c.title.toLowerCase().includes('onboarding'));
    const is_onboarding_course_completed = onboardingCourses.every(c => c.status === 'completed');

    return {
      courses: enrolledCourses,
      summary: {
        total_courses,
        total_completed,
        total_in_progress,
        is_onboarding_course_completed
      }
    };
  }

  async getCourseById(courseId , token) {
    return this.makeAuthenticatedRequest('get', `/learn/v1/courses/${courseId}` , null , null ,token);   
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

  async getCourseDownloadUrl(courseId) {
    const resp = await this.makeAuthenticatedRequest('get', `/learn/v1/courses/${courseId}/los`);
    return resp.data;
  }

  async getUserById(userId) {
    try {
      const adminToken = await this.getAccessToken();
      
      // First try to get user by ID directly
      try {
        const directResponse = await this.makeAuthenticatedRequest(
          'get',
          `/manage/v1/user/${userId}`,
          null,
          null,
          adminToken
        );
        
        if (directResponse.data) {
          return directResponse.data;
        }
      } catch (directError) {
        // If direct ID lookup fails, try search by ID
        console.log('Direct ID lookup failed, trying search method...');
      }
      
      // Fallback: Search for user by ID
      const searchResponse = await this.makeAuthenticatedRequest(
        'get', 
        '/manage/v1/user', 
        null, 
        { search_text: userId },
        adminToken
      );
      
      if (searchResponse.data?.items?.length > 0) {
        return searchResponse.data.items[0];
      }
      
      throw new Error('User not found');
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw new AppError('User not found', 404);
    }
  }

  async getUserAccessToken(userId) {
    try {
      // This would typically involve getting user credentials
      // For now, we'll use the admin token approach
      // In a real implementation, you might store user credentials securely
      return await this.getAccessToken();
    } catch (error) {
      console.error('Error getting user access token:', error);
      throw new AppError('Failed to get user access token', 500);
    }
  }

  // Docebo Dashboard Redirection Methods
  async checkUserExistsInDocebo(identifier) {
    try {
      const adminToken = await this.getAccessToken();
      
      // First try to get user by ID directly
      try {
        const directResponse = await this.makeAuthenticatedRequest(
          'get',
          `/manage/v1/user/${identifier}`,
          null,
          null,
          adminToken
        );
        
        if (directResponse.data) {
          const user = directResponse.data.user_data;
          return {
            exists: true,
            user: {
              user_id: user.user_id,
              username: user.username,
              email: user.email,
              firstname: user.first_name,
              lastname: user.last_name,
              status: user.status,
              additional_fields: directResponse.data.additional_fields
            }
          };
        }
      } catch (directError) {
        // If direct ID lookup fails, try search by email or username
        console.log('Direct ID lookup failed, trying search method...');
      }
      
      return {
        exists: false,
        user: null
      };
    } catch (error) {
      console.error('Error checking user existence in Docebo:', error);
      throw new AppError('Failed to check user existence in Docebo', 500);
    }
  }

  async generateDoceboRedirectUrl(userId, redirectPath = null) {
    try {
      // First verify the user exists
      const userCheck = await this.checkUserExistsInDocebo(userId);
      
      if (!userCheck.exists) {
        throw new AppError('User not found in Docebo', 404);
      }

      // Generate Docebo SSO token using MD5 hash
      const ssoToken = await this.generateDoceboSSOToken(userCheck.user.username);
      
      // Construct Docebo SSO URL that bypasses login page
      const baseUrl = config.docebo.baseUrl;
      const path = redirectPath || '/lms';
      
      // Use Docebo's official SSO endpoint format
      // Based on Docebo documentation: /lms/index.php?r=site/sso&login_user=username&time=timestamp&token=md5hash
      // URL encode the username to handle special characters
      const encodedUsername = encodeURIComponent(ssoToken.username);
      const redirectUrl = `${baseUrl}/lms/index.php?r=site/sso&` +
        `login_user=${encodedUsername}&` +
        `time=${ssoToken.time}&` +
        `token=${ssoToken.token}`;
      
      return {
        redirectUrl
      };
    } catch (error) {
      console.error('Error generating Docebo redirect URL:', error);
      throw error;
    }
  }

  async generateDoceboSSOToken(username) {
    try {
      // Get current UTC time in seconds
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Use Docebo SSO secret (must be configured in Docebo admin panel)
      const ssoSecret = config.docebo.ssoSecret;
      
      if (!ssoSecret) {
        throw new Error('SSO secret not configured. Please set DOCEBO_SSO_SECRET in your environment variables.');
      }
      
      // Create MD5 hash of: username,time,secret (comma-separated as per Docebo docs)
      const hashString = `${username.toLowerCase()},${currentTime},${ssoSecret}`;
      const token = crypto.createHash('md5').update(hashString).digest('hex');
      
      return {
        token,
        time: currentTime,
        username: username.toLowerCase(),
        hashString // For debugging
      };
    } catch (error) {
      console.error('Error generating Docebo SSO token:', error);
      throw new AppError('Failed to generate Docebo SSO token', 500);
    }
  }
}

module.exports = new DoceboService();
