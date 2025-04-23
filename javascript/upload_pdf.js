document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const CONFIG = {
        API: {
            API_ENDPOINT: 'https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/uploadpdf'
        },
        UPLOAD: {
            MAX_FILE_SIZE_MB: 10,
            ALLOWED_FILE_TYPES: ['application/pdf'],
            TIMEOUT_MS: 60000,
            MAX_RETRIES: 2,
            RETRY_DELAY_MS: 2000
        },
        UI: {
            ALERT_TIMEOUT_MS: 5000,
            PROGRESS_HIDE_DELAY_MS: 3000
        }
    };

    // Utility Functions
    const Utils = {
        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        formatFileSize(bytes) {
            if (bytes < 1024) return `${bytes} bytes`;
            if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / 1048576).toFixed(1)} MB`;
        },

        sanitizeHTML(str) {
            const temp = document.createElement('div');
            temp.textContent = str;
            return temp.innerHTML;
        }
    };

    // UI Manager for notifications and progress indication
    const UIManager = {
        showAlert(message, type = 'info') {
            const alertsContainer = document.getElementById('alerts-container');
            if (!alertsContainer) {
                console.error('Alerts container not found');
                return;
            }
            
            const alert = document.createElement('div');
            alert.className = `alert alert-${type}`;
            alert.innerHTML = Utils.sanitizeHTML(message);
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-btn';
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', () => alert.remove());
            
            alert.appendChild(closeBtn);
            alertsContainer.appendChild(alert);
            
            setTimeout(() => {
                alert.classList.add('fade-out');
                setTimeout(() => alert.remove(), 500);
            }, CONFIG.UI.ALERT_TIMEOUT_MS);
        },
        
        showProgress(message, progress = 0) {
            const progressContainer = document.getElementById('progress-container');
            if (!progressContainer) {
                console.error('Progress container not found');
                return;
            }
            
            progressContainer.style.display = 'block';
            
            const progressBar = document.getElementById('progress-bar');
            const progressText = document.getElementById('progress-text');
            
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressText) progressText.textContent = message;
            
            if (progress === 100) {
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, CONFIG.UI.PROGRESS_HIDE_DELAY_MS);
            }
        },
        
        hideProgress() {
            const progressContainer = document.getElementById('progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        }
    };

    // Unified Tab Management System
    const TabManager = {
        // Initialize all tab systems
        init() {
            // Primary Navigation Tabs
            this.setupTabSystem('.primary-nav .tab-btn', 'primary-nav');
        },

        // Generic tab setup method
        setupTabSystem(tabSelector, navType) {
            const tabButtons = document.querySelectorAll(tabSelector);
            
            tabButtons.forEach(tab => {
                tab.addEventListener('click', () => {
                    this.switchTab(tabButtons, tab, navType);
                });
            });

            // Setup initial state
            this.setupInitialState(tabButtons, navType);
        },

        // Setup initial tab state
        setupInitialState(tabs, navType) {
            const activeTab = Array.from(tabs).find(tab => tab.classList.contains('active'));
            
            if (activeTab) {
                const targetId = activeTab.getAttribute('data-tab');
                const contentSections = this.getContentSections(navType);
                
                // Hide all sections
                contentSections.forEach(section => {
                    section.classList.remove('active');
                    section.setAttribute('aria-hidden', 'true');
                    section.style.display = 'none';
                });
                
                // Show initial active section
                const initialSection = document.getElementById(targetId);
                if (initialSection) {
                    initialSection.classList.add('active');
                    initialSection.setAttribute('aria-hidden', 'false');
                    initialSection.style.display = 'block';
                }
            }
        },

        // Switch between tabs
        switchTab(tabGroup, selectedTab, navType) {
            const targetId = selectedTab.getAttribute('data-tab');
            
            // Reset all tabs in this group
            tabGroup.forEach(tab => {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            });
            
            // Activate selected tab
            selectedTab.classList.add('active');
            selectedTab.setAttribute('aria-selected', 'true');
            
            // Get content sections for this navigation type
            const contentSections = this.getContentSections(navType);
            
            // Hide all sections
            contentSections.forEach(section => {
                section.classList.remove('active');
                section.setAttribute('aria-hidden', 'true');
                section.style.display = 'none';
            });
            
            // Show target section
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                targetSection.setAttribute('aria-hidden', 'false');
                targetSection.style.display = 'block';
            }
        },

        // Get content sections based on navigation type
        getContentSections(navType) {
            switch(navType) {
                case 'primary-nav':
                    return document.querySelectorAll('.main-content > .container > .tab-content');
                default:
                    return [];
            }
        }
    };

    // Initialize Tab Manager
    TabManager.init();
    
    // ---------- File Input and Drag & Drop Handling ----------
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const selectedFiles = new Set();

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const files = this.files;
            for (let i = 0; i < files.length; i++) {
                if (CONFIG.UPLOAD.ALLOWED_FILE_TYPES.includes(files[i].type)) {
                    if (!validateFileSize(files[i], CONFIG.UPLOAD.MAX_FILE_SIZE_MB)) {
                        UIManager.showAlert(`File ${files[i].name} exceeds maximum size of ${CONFIG.UPLOAD.MAX_FILE_SIZE_MB}MB`, 'danger');
                        continue;
                    }
                    if (!selectedFiles.has(files[i].name)) {
                        selectedFiles.add(files[i].name);
                        addFileToList(files[i]);
                    }
                } else {
                    UIManager.showAlert(`File ${files[i].name} is not a PDF`, 'danger');
                }
            }
        });
    }

    const fileInputLabel = document.querySelector('.file-upload-label');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileInputLabel.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        fileInputLabel.addEventListener(eventName, () => fileInputLabel.classList.add('highlight'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileInputLabel.addEventListener(eventName, () => fileInputLabel.classList.remove('highlight'), false);
    });

    fileInputLabel.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        updateFileList(files);
    }

    function updateFileList(files) {
        for (let i = 0; i < files.length; i++) {
            if (CONFIG.UPLOAD.ALLOWED_FILE_TYPES.includes(files[i].type)) {
                if (!validateFileSize(files[i], CONFIG.UPLOAD.MAX_FILE_SIZE_MB)) {
                    UIManager.showAlert(`File ${files[i].name} exceeds maximum size of ${CONFIG.UPLOAD.MAX_FILE_SIZE_MB}MB`, 'danger');
                    continue;
                }
                if (!selectedFiles.has(files[i].name)) {
                    selectedFiles.add(files[i].name);
                    addFileToList(files[i]);
                }
            } else {
                UIManager.showAlert(`File ${files[i].name} is not a PDF`, 'danger');
            }
        }
    }

    function validateFileSize(file, maxSizeMB) {
        const maxSize = maxSizeMB * 1024 * 1024;
        return file.size <= maxSize;
    }

    function addFileToList(file) {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = `${file.name} (${Utils.formatFileSize(file.size)})`;
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            li.remove();
            selectedFiles.delete(file.name);
        });
        
        li.appendChild(span);
        li.appendChild(removeBtn);
        fileList.appendChild(li);
    }

    function resetForm() {
        document.getElementById('upload-form').reset();
        fileList.innerHTML = '';
        selectedFiles.clear();
    }

    // Dynamic field management
// Dynamic field management
const uploadTypeSelect = document.getElementById('upload-type');
if (uploadTypeSelect) {
    uploadTypeSelect.addEventListener('change', function() {
        const studentIdFieldContainer = document.querySelector('.student-id-container');
        
        // If student ID field doesn't exist yet, create it when needed
        if (this.value === 'student' && !document.getElementById('student-id')) {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group student-id-container';
            formGroup.innerHTML = `
                <label for="student-id">Student ID</label>
                <input type="text" id="student-id" class="form-control" placeholder="Enter your student ID" />
            `;
            
            // Insert after assignment-id field
            const assignmentIdField = document.getElementById('assignment-id').closest('.form-group');
            if (assignmentIdField && assignmentIdField.parentNode) {
                assignmentIdField.parentNode.insertBefore(formGroup, assignmentIdField.nextSibling);
            }
        } else if (this.value !== 'student' && studentIdFieldContainer) {
            // Remove student ID field if it exists and upload type is not 'student'
            studentIdFieldContainer.remove();
        }
        
        // Adjust assignment ID label based on upload type
        const assignmentIdLabel = document.querySelector('label[for="assignment-id"]');
        if (assignmentIdLabel) {
            assignmentIdLabel.textContent = this.value === 'teacher' ? 'Assignment ID' : 'Assignment ID';
        }
        
        // Dynamic heading update based on upload type
        const cardHeader = document.querySelector('.card-header h2');
        if (cardHeader) {
            if (this.value === 'student') {
                cardHeader.innerHTML = '<i class="fas fa-file-upload"></i> Upload Assignment';
            } else if (this.value === 'teacher') {
                cardHeader.innerHTML = '<i class="fas fa-file-upload"></i> Upload Question Paper';
            }
        }
    });
}

    // ---------- Upload Form Submission ----------
    const uploadForm = document.getElementById('upload-form');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const alertsContainer = document.getElementById('alerts-container');

    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const uploadType = document.getElementById('upload-type').value;
        if (!uploadType) {
            UIManager.showAlert('Please select upload type', 'danger');
            return;
        }
        
        // Validate assignment ID only for student uploads
        if (uploadType === 'student') {
            const assignmentId = document.getElementById('assignment-id').value;
            if (!assignmentId) {
                UIManager.showAlert('Please enter Assignment ID', 'danger');
                return;
            }
        }
        
        if (fileList.children.length === 0) {
            UIManager.showAlert('Please select at least one file', 'danger');
            return;
        }

        progressContainer.style.display = 'block';
        alertsContainer.innerHTML = '';

        try {
            const metadata = {
                uploadType: uploadType,
                files: []
            };

            if (uploadType === 'student') {
                metadata.assignmentId = document.getElementById('assignment-id').value;
                const courseId = document.getElementById('course-id').value;
                if (courseId) {
                    metadata.courseId = courseId;
                }
                const studentIdField = document.getElementById('student-id');
                if (studentIdField && studentIdField.value) {
                    metadata.studentId = studentIdField.value;
                }
            } else if (uploadType === 'teacher') {
                metadata.assignmentId = document.getElementById('assignment-id').value;
                const courseId = document.getElementById('course-id').value;
                if (courseId) {
                    metadata.courseId = courseId;
                }
            }
            

            // Collect file information from the file input
            const fileInputFiles = fileInput.files;
            const filesToUpload = [];
            for (let i = 0; i < fileInputFiles.length; i++) {
                if (selectedFiles.has(fileInputFiles[i].name)) {
                    filesToUpload.push(fileInputFiles[i]);
                    metadata.files.push({
                        name: fileInputFiles[i].name,
                        type: fileInputFiles[i].type,
                        size: fileInputFiles[i].size
                    });
                }
            }

            const submitButton = uploadForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Uploading...';
            }

            // Request presigned URLs from the server using the configured endpoint
            let response;
            try {
                response = await fetch(CONFIG.API.API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Origin': window.location.origin
                    },
                    body: JSON.stringify(metadata),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server error (${response.status}): ${errorText}`);
                }
            } catch (fetchError) {
                throw new Error(`Failed to connect to server: ${fetchError.message}`);
            }

            const presignedData = await response.json();

            const totalFiles = filesToUpload.length;
            let completedFiles = 0;
            let failedFiles = 0;

            const fileProgressElements = filesToUpload.map((file) => {
                const fileProgressDiv = document.createElement('div');
                fileProgressDiv.className = 'file-progress';
                fileProgressDiv.innerHTML = `
                    <p>${file.name} (0%)</p>
                    <div class="progress">
                        <div class="progress-bar" style="width: 0%"></div>
                    </div>
                `;
                progressContainer.appendChild(fileProgressDiv);
                return {
                    element: fileProgressDiv,
                    progressBar: fileProgressDiv.querySelector('.progress-bar'),
                    progressText: fileProgressDiv.querySelector('p')
                };
            });

            const uploadPromises = filesToUpload.map(async (file, index) => {
                const presignedUrl = presignedData.urls[index];
                const fileProgress = fileProgressElements[index];

                try {
                    await uploadFileWithPresignedUrl(file, presignedUrl, (progress) => {
                        fileProgress.progressBar.style.width = `${progress}%`;
                        fileProgress.progressText.textContent = `${file.name} (${progress}%)`;
                    });
                    completedFiles++;
                    updateTotalProgress(completedFiles, failedFiles, totalFiles);
                    return { success: true };
                } catch (error) {
                    failedFiles++;
                    fileProgress.element.classList.add('upload-failed');
                    fileProgress.progressText.textContent = `${file.name} (Failed: ${error.message})`;
                    updateTotalProgress(completedFiles, failedFiles, totalFiles);
                    return { success: false, error: error.message };
                }
            });

            const results = await Promise.all(uploadPromises);
            if (failedFiles === 0) {
                UIManager.showAlert('All files uploaded successfully!', 'success');
                resetForm();
            } else {
                UIManager.showAlert(`Upload completed with ${failedFiles} failed file(s) out of ${totalFiles}`, 'warning');
            }
        } catch (error) {
            UIManager.showAlert(`Upload failed: ${error.message}`, 'danger');
        } finally {
            setTimeout(() => {
                // Clear file progress elements
                Array.from(progressContainer.querySelectorAll('.file-progress')).forEach(el => el.remove());
                progressContainer.style.display = 'none';
            }, CONFIG.UI.PROGRESS_HIDE_DELAY_MS);

            const submitButton = uploadForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Upload Files';
            }
        }
    });

    async function uploadFileWithPresignedUrl(file, presignedUrl, progressCallback) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', presignedUrl, true);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.timeout = CONFIG.UPLOAD.TIMEOUT_MS;
            
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressCallback(percentComplete);
                }
            });
            
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`HTTP error ${xhr.status}: ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('Network error occurred'));
            };
            
            xhr.ontimeout = function() {
                reject(new Error('Upload timed out'));
            };
            
            let retries = 0;
            const maxRetries = CONFIG.UPLOAD.MAX_RETRIES;
            function tryUpload() {
                try {
                    xhr.send(file);
                } catch (e) {
                    if (retries < maxRetries) {
                        retries++;
                        setTimeout(tryUpload, CONFIG.UPLOAD.RETRY_DELAY_MS);
                    } else {
                        reject(new Error(`Upload failed after ${maxRetries} retries`));
                    }
                }
            }
            tryUpload();
        });
    }

    function updateTotalProgress(completed, failed, total) {
        const percentComplete = Math.round(((completed + failed) / total) * 100);
        progressBar.style.width = percentComplete + '%';
        progressText.textContent = `${percentComplete}% (${completed}/${total} files)`;
    }
});