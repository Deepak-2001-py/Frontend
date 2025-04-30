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