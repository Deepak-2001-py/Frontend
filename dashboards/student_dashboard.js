   // Check user type and show appropriate navbar
   document.addEventListener('DOMContentLoaded', function() {
    // Get user type from storage (localStorage or sessionStorage)
    const userType = localStorage.getItem('userType') || sessionStorage.getItem('userType') || 'student';
    
    // Show the appropriate navbar based on user type
    if (userType === 'teacher') {
      document.getElementById('studentNavbar').style.display = 'none';
      document.getElementById('teacherNavbar').style.display = 'block';
    } else {
      document.getElementById('studentNavbar').style.display = 'block';
      document.getElementById('teacherNavbar').style.display = 'none';
    }
    
    // Mobile menu toggle for student navbar
    document.getElementById('mobileMenuBtn').addEventListener('click', function() {
      document.getElementById('navLinks').classList.toggle('active');
    });
    
    // Mobile menu toggle for teacher navbar
    document.getElementById('teacherMobileMenuBtn').addEventListener('click', function() {
      document.getElementById('teacherNavLinks').classList.toggle('active');
    });
    
    // User dropdown toggle for student
    document.getElementById('userDropdownToggle').addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('userDropdownMenu').classList.toggle('show');
    });
    
    // User dropdown toggle for teacher
    document.getElementById('teacherUserDropdownToggle').addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('teacherUserDropdownMenu').classList.toggle('show');
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function() {
      document.getElementById('userDropdownMenu').classList.remove('show');
      document.getElementById('teacherUserDropdownMenu').classList.remove('show');
    });
    
    // Logout functionality for student
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
      e.preventDefault();
      // Clear storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userType');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userId');
      sessionStorage.removeItem('userType');
      
      // Redirect to login page
      window.location.href = '../auth/login.html';
    });
    
    // Logout functionality for teacher
    document.getElementById('teacherLogoutBtn').addEventListener('click', function(e) {
      e.preventDefault();
      // Clear storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userType');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userId');
      sessionStorage.removeItem('userType');
      
      // Redirect to login page
      window.location.href = '../auth/login.html';
    });
  });
        // API Base URL - Same as in login page
        const API_BASE_URL = 'https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev';
        
        // Mobile menu toggle
        document.getElementById('mobileMenuBtn').addEventListener('click', function() {
          document.getElementById('navLinks').classList.toggle('active');
        });
        
        // Show/hide loading spinner
        function toggleLoading(show) {
          document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
        }
        
        // Check if user is logged in
        function checkAuthStatus() {
          // First check sessionStorage, then localStorage
          const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
          const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
          const name = sessionStorage.getItem('name') || localStorage.getItem('name');
          
          if (!token || !userId) {
            // Not logged in, redirect to login page
            window.location.href = '../auth/login.html';
            return false;
          }
          
          // Check token expiry (optional - assuming tokens expire after 24 hours)
          const loginTime = sessionStorage.getItem('loginTime') || localStorage.getItem('loginTime');
          if (loginTime) {
            const loginDate = new Date(loginTime);
            const now = new Date();
            const hoursSinceLogin = (now - loginDate) / (1000 * 60 * 60);
            
            if (hoursSinceLogin > 24) {
              // Token expired, clear and redirect
              sessionStorage.removeItem('authToken');
              sessionStorage.removeItem('userId');
              sessionStorage.removeItem('loginTime');
              localStorage.removeItem('authToken');
              localStorage.removeItem('userId');
              localStorage.removeItem('loginTime');
              
              window.location.href = '../auth/login.html';
              return false;
            }
          }
          
          return {token, userId};
        }
        
        // Fetch user data from API
        async function fetchUserData(userId, token) {
          try {
            toggleLoading(true);
            
            const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Origin': window.location.origin
              }
            });
            
            if (!response.ok) {
              throw new Error('Failed to fetch user data');
            }
            
            const userData = await response.json();
            return userData;
            
          } catch (error) {
            console.error('Error fetching user data:', error);
            return null;
          } finally {
            toggleLoading(false);
          }
        }
        
        // Fetch student's assignments and grades from API
        async function fetchStudentData(userId, token) {
          try {
            toggleLoading(true);
            
            // Fetch assignments
            const assignmentsResponse = await fetch(`${API_BASE_URL}/students/${userId}/assignments`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Origin': window.location.origin
              }
            });
            
            if (!assignmentsResponse.ok) {
              throw new Error('Failed to fetch assignments data');
            }
            
            const assignmentsData = await assignmentsResponse.json();
            
            // Fetch grades
            const gradesResponse = await fetch(`${API_BASE_URL}/students/${userId}/grades`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Origin': window.location.origin
              }
            });
            
            if (!gradesResponse.ok) {
              throw new Error('Failed to fetch grades data');
            }
            
            const gradesData = await gradesResponse.json();
            
            return {
              assignments: assignmentsData,
              grades: gradesData
            };
            
          } catch (error) {
            console.error('Error fetching student data:', error);
            return null;
          } finally {
            toggleLoading(false);
          }
        }
        
        // Update UI with user data
        function updateUserInterface(userData) {
          // Set user name
          const userName = document.getElementById('userName');
          if (userData && userData.name) {
            userName.textContent = userData.name;
          } else {
            userName.textContent = 'Student';
          }
          
          // Update auth buttons
          const authButtons = document.getElementById('authButtons');
          authButtons.innerHTML = `
            <a href="student_profile.html" class="btn btn-secondary">My Profile</a>
            <button id="logoutBtn" class="btn btn-primary">Log Out</button>
          `;
          
          // Add logout functionality
          document.getElementById('logoutBtn').addEventListener('click', function() {
            // Clear storage
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('userId');
            sessionStorage.removeItem('loginTime');
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('name');
            localStorage.removeItem('loginTime');
            
            // Redirect to login page
            window.location.href = '../auth/login.html';
          });
        }
        
        // Update dashboard with student data
        function updateDashboardData(studentData) {
          // In a real implementation, you would use the studentData to populate the dashboard
          // This is a placeholder function that would normally update all the dynamic elements
          
          // For example:
          // - Update grades statistics
          // - Populate upcoming assignments table
          // - Update progress bars
          // - Add feedback items
          
          console.log('Student data loaded:', studentData);
        }
        
        // Initialize dashboard
        async function initDashboard() {
          const auth = checkAuthStatus();
          if (!auth) return; // Already redirected if not logged in
          
          // Fetch user data from API
          const userData = await fetchUserData(auth.userId, auth.token);
          
          // Update UI with user data
          updateUserInterface(userData);
          
          // Fetch student-specific data (assignments, grades, etc.)
          const studentData = await fetchStudentData(auth.userId, auth.token);
          
          // Update dashboard with student data
          if (studentData) {
            updateDashboardData(studentData);
          }
          
          // Add event listeners for buttons
          document.getElementById('viewAssignmentsBtn').addEventListener('click', function() {
            window.location.href = '../student_upload.html';
          });
          
          // More initialization code as needed
        }
        
        // Call initialization function when page loads
        document.addEventListener('DOMContentLoaded', initDashboard);
    
        // For demo purposes - make table rows clickable
        document.querySelectorAll('.assignment-table tbody tr').forEach(row => {
          row.style.cursor = 'pointer';
          row.addEventListener('click', function(e) {
            // Don't trigger if they clicked on the button
            if (e.target.tagName.toLowerCase() !== 'button' && !e.target.closest('button')) {
              const assignmentName = this.querySelector('td').textContent;
              console.log(`Clicked on assignment: ${assignmentName}`);
              // In real implementation, navigate to assignment details page
              // window.location.href = `assignment_details.html?id=123`;
            }
          });
        });
        function setNavAndGo(navId, url) {
          sessionStorage.setItem('activeNavLink', navId); // store nav ID
          location.href = url; // go to the target page
        }
        