// UI-related functions

// Function to show a modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

// Function to hide a modal
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Function to show a notification
function showNotification(title, message, duration = 5000) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    }
    
    // Set content
    notification.innerHTML = `
        <h4>${title}</h4>
        <p>${message}</p>
    `;
    
    // Show notification
    notification.style.display = 'block';
    
    // Hide after duration
    if (duration > 0) {
        setTimeout(() => {
            notification.style.display = 'none';
        }, duration);
    }
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-notification';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
        notification.style.display = 'none';
    });
    notification.appendChild(closeBtn);
    
    return notification;
} 