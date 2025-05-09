/**
 * Component Loader for GradeAnt
 * Loads HTML components dynamically into specified containers
 */

// Component loader function
function loadComponent(targetId, componentPath) {
    const targetElement = document.getElementById(targetId);
    
    if (!targetElement) {
      console.error(`Target element with ID '${targetId}' not found in the DOM`);
      return;
    }
    
    // Fetch the component HTML
    fetch(componentPath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load component from ${componentPath}: ${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then(html => {
        // Insert the component HTML
        targetElement.innerHTML = html;
        
        // Execute any scripts contained in the component
        const scripts = targetElement.querySelectorAll('script');
        scripts.forEach(script => {
          const newScript = document.createElement('script');
          
          // Copy all attributes
          Array.from(script.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
          });
          
          // Copy the script content
          newScript.textContent = script.textContent;
          
          // Replace the old script with the new one to execute it
          script.parentNode.replaceChild(newScript, script);
        });
      })
      .catch(error => {
        console.error('Error loading component:', error);
        targetElement.innerHTML = `<div class="error-message">Failed to load component. Please refresh the page.</div>`;
      });
  }
  
  // Initialize common components when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Check if we have navigation and footer elements to load components into
    if (document.getElementById('nav')) {
      loadComponent('nav', '../nav.html');
    }
    
    if (document.getElementById('footer')) {
      loadComponent('footer', 'partials/footer.html');
    }
  });
/**
 * Component Loader for GradeAnt Dashboard
 * This script helps manage navigation and component loading
 */

// // Keep track of active navigation item
// let activeNavItem = null;

// /**
//  * Load an HTML component into a target element
//  * @param {string} targetId - ID of the element to load content into
//  * @param {string} componentPath - Path to the HTML component
//  */
// function loadComponent(targetId, componentPath) {
//   const targetElement = document.getElementById(targetId);
  
//   if (!targetElement) {
//     console.error(`Target element with ID "${targetId}" not found`);
//     return;
//   }
  
//   // Show loading spinner if it exists
//   const spinner = document.getElementById('loadingSpinner');
//   if (spinner) spinner.style.display = 'flex';
  
//   // Fetch the component
//   fetch(componentPath)
//     .then(response => {
//       if (!response.ok) {
//         throw new Error(`Failed to load component from ${componentPath}`);
//       }
//       return response.text();
//     })
//     .then(html => {
//       targetElement.innerHTML = html;
      
//       // Initialize any script in the loaded component
//       const scripts = targetElement.querySelectorAll('script');
//       scripts.forEach(script => {
//         const newScript = document.createElement('script');
//         if (script.src) {
//           newScript.src = script.src;
//         } else {
//           newScript.textContent = script.textContent;
//         }
//         document.body.appendChild(newScript);
//       });
      
//       // Set active navigation item if applicable
//       if (activeNavItem) {
//         setActiveNavItem(activeNavItem);
//       }
      
//       // Hide loading spinner
//       if (spinner) spinner.style.display = 'none';
//     })
//     .catch(error => {
//       console.error('Error loading component:', error);
//       targetElement.innerHTML = `<div class="error-message">Failed to load component. Please try again.</div>`;
//       if (spinner) spinner.style.display = 'none';
//     });
// }

// /**
//  * Set the active navigation item
//  * @param {string} navId - ID of the navigation item to set as active
//  */
// function setActiveNavItem(navId) {
//   activeNavItem = navId;
  
//   // Remove active class from all nav items
//   const navItems = document.querySelectorAll('.nav-item');
//   navItems.forEach(item => {
//     item.classList.remove('active');
//   });
  
//   // Add active class to the specified nav item
//   const activeItem = document.getElementById(navId);
//   if (activeItem) {
//     activeItem.classList.add('active');
//   }
// }

// /**
//  * Combined function to set active navigation and go to a page
//  * @param {string} navId - ID of the navigation item
//  * @param {string} url - URL to navigate to
//  */
// function setNavAndGo(navId, url) {
//   setActiveNavItem(navId);
//   location.href = url;
// }

// // Initialize components when the page loads
// document.addEventListener('DOMContentLoaded', function() {
//   // Load navigation component if nav element exists
//   const navElement = document.getElementById('nav');
//   if (navElement) {
//     loadComponent('nav', '../nav.html');
//   }
  
//   // Set user name if available from localStorage
//   const userNameElement = document.getElementById('userName');
//   if (userNameElement) {
//     const storedName = localStorage.getItem('teacherName');
//     if (storedName) {
//       userNameElement.textContent = storedName;
//     }
//   }
// });