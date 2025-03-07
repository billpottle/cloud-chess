// Login function - Update to work with your existing token system
function login(username, password) {
    return fetch('api/login.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Store authentication data in localStorage
            localStorage.setItem('chessAuthToken', data.token);
            localStorage.setItem('chessUsername', data.username);
            localStorage.setItem('chessUserId', data.user_id);
            return true;
        } else {
            throw new Error(data.message);
        }
    });
}

// Logout function
function logout() {
    // First clear localStorage tokens
    localStorage.removeItem('chessAuthToken');
    localStorage.removeItem('chessUsername');
    localStorage.removeItem('chessUserId');
    
    // Then call the server to clean up the session and database token
    fetch('api/logout.php')
        .then(response => response.json())
        .catch(error => {
            console.error('Error during logout:', error);
        })
        .finally(() => {
            // Always redirect to home page, even if server request fails
            window.location.href = 'index.html';
        });
}

// Check if user is logged in
function isLoggedIn() {
    return !!localStorage.getItem('chessAuthToken');
}

// Get current user info
function getCurrentUser() {
    return {
        username: localStorage.getItem('chessUsername'),
        userId: localStorage.getItem('chessUserId')
    };
} 