
  document.addEventListener('DOMContentLoaded', function () {
    const userType = localStorage.getItem('userType') || sessionStorage.getItem('userType') || 'student';

    // Navbar visibility
    const studentNavbar = document.getElementById('studentNavbar');
    const teacherNavbar = document.getElementById('teacherNavbar');
    if (userType === 'teacher') {
      if (teacherNavbar) teacherNavbar.style.display = 'block';
      if (studentNavbar) studentNavbar.style.display = 'none';
    } else {
      if (studentNavbar) studentNavbar.style.display = 'block';
      if (teacherNavbar) teacherNavbar.style.display = 'none';
    }

    // Utility: Toggle menu class
    function toggleMenu(btnId, menuId) {
      const btn = document.getElementById(btnId);
      const menu = document.getElementById(menuId);
      if (btn && menu) {
        btn.addEventListener('click', function () {
          menu.classList.toggle('active');
        });
      }
    }

    // Utility: Toggle dropdown menu
    function toggleDropdown(toggleId, menuId) {
      const toggle = document.getElementById(toggleId);
      const menu = document.getElementById(menuId);
      if (toggle && menu) {
        toggle.addEventListener('click', function (e) {
          e.stopPropagation();
          menu.classList.toggle('show');
        });
      }
    }

    // Utility: Logout logic
    function setupLogout(btnId) {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          ['authToken', 'userId', 'userType'].forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          });
          window.location.href = '../auth/login.html';
        });
      }
    }

    // Attach toggles
    toggleMenu('mobileMenuBtn', 'navLinks');
    toggleMenu('teacherMobileMenuBtn', 'teacherNavLinks');
    toggleDropdown('userDropdownToggle', 'userDropdownMenu');
    toggleDropdown('teacherUserDropdownToggle', 'teacherUserDropdownMenu');
    setupLogout('logoutBtn');
    setupLogout('teacherLogoutBtn');

    // Close dropdowns on outside click
    document.addEventListener('click', function () {
      const studentDropdown = document.getElementById('userDropdownMenu');
      const teacherDropdown = document.getElementById('teacherUserDropdownMenu');
      if (studentDropdown) studentDropdown.classList.remove('show');
      if (teacherDropdown) teacherDropdown.classList.remove('show');
    });

    // Highlight active menu item based on URL
    const path = window.location.pathname;
    const navMap = {
      'dashboard': ['/dashboards/teacher_dashboard.html', 'teacher-nav-dashboard'],
      'upload': ['teacher_upload', 'teacher-nav-upload'],
      'analytics': ['nav-analytics', 'teacher-nav-analytics'],
      'get-grades': ['teacher_view_grade', 'teacher-nav-grades']
    };

    Object.keys(navMap).forEach(key => {
      if (path.includes(key)) {
        navMap[key].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.classList.add('active');
        });
      }
    });
  });

