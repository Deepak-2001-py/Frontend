// profile.js - Handles displaying user data from local/session storage

document.addEventListener('DOMContentLoaded', function() {
    // Load user data from storage
    loadUserProfile();
    
    // Set up event listeners
    setupEventListeners();
    
    // Check authentication
    checkAuthentication();
  });
  
  /**
   * Load user profile data from localStorage or sessionStorage
   */
  function loadUserProfile() {
    // First check localStorage, then sessionStorage
    const storageLocations = [localStorage, sessionStorage];
    let userData = null;
    
    // Try to get the full userData object first
    for (const storage of storageLocations) {
      const rawUserData = storage.getItem('userData');
      if (rawUserData) {
        try {
          userData = JSON.parse(rawUserData);
          break;
        } catch (e) {
          console.error('Error parsing userData:', e);
        }
      }
    }
    
    // If we don't have the full userData object, collect individual items
    if (!userData) {
      userData = {};
      
      // The keys we want to retrieve from storage
      const dataKeys = ['userId', 'userType', 'userName', 'authToken', 'loginTime'];
      
      // Try to get each key from localStorage or sessionStorage
      for (const key of dataKeys) {
        for (const storage of storageLocations) {
          const value = storage.getItem(key);
          if (value) {
            userData[key] = value;
            break;
          }
        }
      }
      
      // Map storage keys to our expected schema
      if (userData.userId) userData.user_id = userData.userId;
      if (userData.userType) userData.userRole = userData.userType;
      if (userData.userName) userData.name = userData.userName;
    }
    
    // Now populate the profile page with the data we found
    populateProfile(userData);
  }
  
  /**
   * Populate the profile page with user data
   * @param {Object} userData - User data from storage
   */
  function populateProfile(userData) {
    // If no user data is available, show error
    if (!userData || Object.keys(userData).length === 0) {
      showError('Unable to load user profile data');
      return;
    }
    
    // Set basic profile fields
    document.getElementById('profileName').textContent = userData.name || 'Unknown User';
    document.getElementById('profileRole').textContent = capitalizeFirstLetter(userData.userRole || userData.userType || 'User');
    document.getElementById('profileUserId').textContent = userData.user_id || userData.userId || 'Not available';
    
    // Set email (may not be available in storage)
    document.getElementById('profileEmail').textContent = userData.email || 'Not available';
    
    // Format and display last login time
    let loginTime = userData.loginTime ? new Date(userData.loginTime) : null;
    document.getElementById('profileLastLogin').textContent = loginTime ? 
      formatDate(loginTime) : 'Not available';
    
    // Set appropriate avatar based on user role
    const avatarElement = document.getElementById('profileAvatar');
    if (userData.userRole === 'teacher' || userData.userType === 'teacher') {
      avatarElement.src = '../img/teacher-avatar.jpg';
      avatarElement.alt = 'Teacher Avatar';
    } else {
      avatarElement.src = '../img/student.jpg';
      avatarElement.alt = 'Student Avatar';
    }
    
    // Add any additional details from userData
    const additionalContainer = document.getElementById('additionalDetailsContainer');
    additionalContainer.innerHTML = ''; // Clear any existing content
    
    // List of keys we've already handled
    const handledKeys = ['name', 'userRole', 'userType', 'user_id', 'userId', 'email', 'loginTime', 'authToken'];
    
    // Display any other data in the userData object
    for (const [key, value] of Object.entries(userData)) {
      // Skip keys we've already handled or that should be private
      if (handledKeys.includes(key) || key === 'token' || key === 'authToken' || key === 'password') {
        continue;
      }
      
      // Create and add the detail item
      const detailHTML = `
        <div class="detail-item">
          <span class="material-icons">info</span>
          <div>
            <h3>${formatLabel(key)}</h3>
            <p>${value}</p>
          </div>
        </div>
      `;
      additionalContainer.innerHTML += detailHTML;
    }
  }
  
  /**
   * Set up event listeners for buttons
   */
  function setupEventListeners() {
    // Edit profile button
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
      editProfileBtn.addEventListener('click', function() {
        alert('Edit profile functionality would be implemented here');
        // In a real app, this would open a modal or navigate to an edit page
      });
    }
    
    // Change password button
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', function() {
        alert('Change password functionality would be implemented here');
        // In a real app, this would open a modal or navigate to a password change page
      });
    }
  }
  
  /**
   * Check if user is authenticated, redirect to login if not
   */
  function checkAuthentication() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
      // User is not authenticated, redirect to login
      window.location.href = '../auth/login.html';
    }
  }
  
  /**
   * Display an error message on the page
   * @param {string} message - Error message to display
   */
  function showError(message) {
    // Create error element if it doesn't exist
    let errorElement = document.getElementById('profileError');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'profileError';
      errorElement.className = 'error-message';
      
      // Insert at the top of the profile card
      const profileCard = document.querySelector('.profile-card');
      if (profileCard) {
        profileCard.insertBefore(errorElement, profileCard.firstChild);
      }
    }
    
    // Set the error message
    errorElement.textContent = message;
  }
  
  /**
   * Format a date object to a readable string
   * @param {Date} date - Date to format
   * @return {string} Formatted date string
   */
  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) return 'Invalid date';
    
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return date.toLocaleDateString(undefined, options);
  }
  
  /**
   * Capitalize the first letter of a string
   * @param {string} str - String to capitalize
   * @return {string} Capitalized string
   */
  function capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  /**
   * Format a camelCase or snake_case key as a readable label
   * @param {string} key - Key to format
   * @return {string} Formatted label
   */
  function formatLabel(key) {
    if (!key) return '';
    
    // Replace underscores and camelCase with spaces
    return key
      // Insert a space before all caps
      .replace(/([A-Z])/g, ' $1')
      // Replace underscores with spaces
      .replace(/_/g, ' ')
      // Capitalize first letter of each word
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }