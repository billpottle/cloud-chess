// Global variables
window.currentUserId = null;
window.currentUsername = null;

// Function to get user information
function getUserInfo(userId) {
    return fetch('api/get_user_info.php?user_id=' + userId)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.status);
            }
            if (response.headers.get('content-length') === '0') {
                throw new Error('Empty response received');
            }
            return response.json();
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
            console.log('Trying fallback API endpoint...');
            // Try the simplified endpoint
            return fetch('api/get_user_basic.php?user_id=' + userId)
                .then(response => response.json());
        });
}

// Function to display user welcome message
function displayUserWelcome(username, userData) {
    // Convert ELO to number and format it
    const elo = parseInt(userData.elo) || 1000;
    let welcomeMsg = 'Welcome, ' + username + ' (ELO: ' + elo;
    
    // Add ranking information if available
    if (userData.ranking && userData.total_users) {
        welcomeMsg += ' | Rank: ' + userData.ranking + '/' + userData.total_users;
    }
    
    welcomeMsg += ')';
    document.getElementById('user-welcome').textContent = welcomeMsg;
}

// Function to handle logout
function logout() {
    const username = localStorage.getItem('chessUsername');
    
    if (!username) {
        // If no username, just clear localStorage and redirect
        clearAuthData();
        window.location.href = 'index.html';
        return;
    }
    
    // Send logout request to server with username
    fetch('api/logout.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Logout response:', data);
        // Clear auth data from localStorage
        clearAuthData();
        // Redirect to home page
        window.location.href = 'index.html';
    })
    .catch(error => {
        console.error('Logout error:', error);
        // Even if there's an error, clear local data and redirect
        clearAuthData();
        window.location.href = 'index.html';
    });
}

// Function to clear authentication data from localStorage
function clearAuthData() {
    localStorage.removeItem('chessAuthToken');
    localStorage.removeItem('chessUsername');
    localStorage.removeItem('chessUserId');
}

// Function to update user activity
function updateUserActivity() {
    if (!window.currentUserId) {
        return; // Don't update if user is not logged in
    }
    
    fetch('api/active_users.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'update'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('User activity updated');
        }
    })
    .catch(error => {
        console.error('Error updating user activity:', error);
    });
}

// Function to load user's active games
function loadUserGames() {
    console.log('loadUserGames called, currentUserId:', window.currentUserId);
    
    if (!window.currentUserId) {
        console.log('No user ID, not loading games');
        return;
    }
    
    // Check if the container exists
    const container = document.getElementById('my-games-container');
    console.log('my-games-container element:', container);
    
    const url = 'api/get_user_games.php?user_id=' + window.currentUserId;
    console.log('Fetching games from:', url);
    
    fetch(url)
        .then(response => {
            console.log('Response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Games data received:', data);
            
            if (data.success) {
                if (!container) {
                    console.error('my-games-container not found in the DOM');
                    return;
                }
                
                if (!data.games || data.games.length === 0) {
                    container.innerHTML = '<p>You have no active games.</p>';
                    return;
                }
                
                // Create table
                let html = '<table class="stats-table">';
                html += '<thead><tr><th>Opponent</th><th>Status</th><th>Last Move</th><th>Action</th></tr></thead>';
                html += '<tbody>';
                
                data.games.forEach(game => {
                    const isUserTurn = game.current_turn_user_id == window.currentUserId;
                    const statusClass = isUserTurn ? 'your-turn' : 'waiting';
                    const statusText = isUserTurn ? 'Your turn' : 'Waiting for opponent';
                    
                    html += `<tr>
                        <td>${game.opponent_username}</td>
                        <td class="${statusClass}">${statusText}</td>
                        <td>${game.last_move_date || 'N/A'}</td>
                        <td><button class="resume-btn" data-game-id="${game.id}">Resume</button></td>
                    </tr>`;
                });
                
                html += '</tbody></table>';
                container.innerHTML = html;
                
                // Add event listeners to resume buttons
                container.querySelectorAll('.resume-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const gameId = this.getAttribute('data-game-id');
                        console.log('Resume button clicked for game ID:', gameId);
                        console.log('Current session data:', {
                            userId: window.currentUserId,
                            username: window.currentUsername
                        });
                        
                        // Store session data in localStorage as a backup
                        localStorage.setItem('chess_user_id', window.currentUserId);
                        localStorage.setItem('chess_username', window.currentUsername);
                        
                        // Make sure we're using the full path
                        window.location.href = 'game.php?id=' + gameId;
                    });
                });
            } else {
                document.getElementById('my-games-container').innerHTML = 
                    '<p>Unable to load your games.</p>';
            }
        })
        .catch(error => {
            console.error('Error loading user games:', error);
            if (container) {
                container.innerHTML = '<p>Error loading your games.</p>';
            }
        });
}

// Function to update game usage statistics
function updateGameStats(gameType) {
    const formData = new FormData();
    formData.append('game_type', gameType);
    
    fetch('api/update_game_stats.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Game usage updated:', data);
        } else {
            console.error('Failed to update game usage:', data.message);
        }
    })
    .catch(error => {
        console.error('Error updating game usage:', error);
    });
}

// Make these functions work with a username parameter instead of requiring a session
function getPublicGamesList(username) {
    return fetch(`api/get_games.php?username=${username}`)
        .then(response => response.json());
}

function getPublicUserStats(username) {
    return fetch(`api/get_stats.php?username=${username}`)
        .then(response => response.json());
}

function getActiveUsers() {
    return fetch('api/get_active_users.php')
        .then(response => response.json());
}

// Initialize user interface based on authentication status
function initializeUserInterface() {
    // Check if user is logged in using token from localStorage
    if (isLoggedIn()) {
        // Get user info from localStorage
        const user = getCurrentUser();
        
        // Set global variables
        window.currentUserId = user.userId;
        window.currentUsername = user.username;
        
        // Update UI for logged-in state
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('user-section').style.display = 'inline';
        
        // Show the my games section
        const myGamesSection = document.getElementById('my-games-section');
        if (myGamesSection) {
            myGamesSection.style.display = 'block';
            loadUserGames();
        }
        
        // Get user ELO and display welcome message
        getUserInfo(user.userId)
            .then(userData => {
                if (userData && userData.success) {
                    displayUserWelcome(user.username, userData);
                } else {
                    // Fallback to basic welcome
                    document.getElementById('user-welcome').textContent = 
                        'Welcome, ' + user.username;
                }
            })
            .catch(error => {
                console.error('Error getting user info:', error);
                // Fallback to basic welcome
                document.getElementById('user-welcome').textContent = 
                    'Welcome, ' + user.username;
            });
    } else {
        // User is not logged in
        document.getElementById('auth-section').style.display = 'inline';
        document.getElementById('user-section').style.display = 'none';
        
        // Hide the my games section
        const myGamesSection = document.getElementById('my-games-section');
        if (myGamesSection) {
            myGamesSection.style.display = 'none';
        }
    }
}

// Function to get user information - now using token auth
function getUserInfo(userId) {
    const token = localStorage.getItem('chessAuthToken');
    
    return fetch(`api/get_user_info.php?user_id=${userId}&token=${token}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.status);
            }
            if (response.headers.get('content-length') === '0') {
                throw new Error('Empty response received');
            }
            return response.json();
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
            console.log('Trying fallback API endpoint...');
            // Try the simplified endpoint
            return fetch(`api/get_user_basic.php?user_id=${userId}&token=${token}`)
                .then(response => response.json());
        });
}

// Function to load user's active games - now using token auth
function loadUserGames() {
    console.log('loadUserGames called, currentUserId:', window.currentUserId);
    
    if (!window.currentUserId) {
        console.log('No user ID, not loading games');
        return;
    }
    
    // Check if the container exists
    const container = document.getElementById('my-games-container');
    console.log('my-games-container element:', container);
    
    const token = localStorage.getItem('chessAuthToken');
    const url = `api/get_user_games.php?user_id=${window.currentUserId}&token=${token}`;
    console.log('Fetching games from:', url);
    
    fetch(url)
        .then(response => {
            console.log('Response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Games data received:', data);
            
            if (data.success) {
                if (!container) {
                    console.error('my-games-container not found in the DOM');
                    return;
                }
                
                if (!data.games || data.games.length === 0) {
                    container.innerHTML = '<p>You have no active games.</p>';
                    return;
                }
                
                // Create table
                let html = '<table class="stats-table">';
                html += '<thead><tr><th>Opponent</th><th>Status</th><th>Last Move</th><th>Action</th></tr></thead>';
                html += '<tbody>';
                
                data.games.forEach(game => {
                    const isUserTurn = game.current_turn_user_id == window.currentUserId;
                    const statusClass = isUserTurn ? 'your-turn' : 'waiting';
                    const statusText = isUserTurn ? 'Your turn' : 'Waiting for opponent';
                    
                    html += `<tr>
                        <td>${game.opponent_username}</td>
                        <td class="${statusClass}">${statusText}</td>
                        <td>${game.last_move_date || 'N/A'}</td>
                        <td><button class="resume-btn" data-game-id="${game.id}">Resume</button></td>
                    </tr>`;
                });
                
                html += '</tbody></table>';
                container.innerHTML = html;
                
                // Add event listeners to resume buttons
                container.querySelectorAll('.resume-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const gameId = this.getAttribute('data-game-id');
                        console.log('Resume button clicked for game ID:', gameId);
                        
                        // Make sure we're using the full path
                        window.location.href = 'game.php?id=' + gameId;
                    });
                });
            } else {
                document.getElementById('my-games-container').innerHTML = 
                    '<p>Unable to load your games.</p>';
            }
        })
        .catch(error => {
            console.error('Error loading user games:', error);
            if (container) {
                container.innerHTML = '<p>Error loading your games.</p>';
            }
        });
}

// Function to update user activity - now using token auth
function updateUserActivity() {
   
    const token = localStorage.getItem('chessAuthToken');

    if(!token){
        return;
    }
    
    fetch('api/active_users.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'update',
            token: token
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('User activity updated');
        }
    })
    .catch(error => {
        console.error('Error updating user activity:', error);
    });
}

// Function to check if user is logged in
function isLoggedIn() {
    return !!localStorage.getItem('chessAuthToken');
}

// Function to get current user info
function getCurrentUser() {
    return {
        username: localStorage.getItem('chessUsername'),
        userId: localStorage.getItem('chessUserId')
    };
}

// Function to load public games
function loadPublicGames() {
    const container = document.getElementById('public-games-container');
    if (!container) return;
    
    // Show loading message
    container.innerHTML = '<p>Loading public games...</p>';
    
    // Get current username from localStorage
    const currentUsername = localStorage.getItem('chessUsername');
    
    fetch('api/get_public_games.php')
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                container.innerHTML = '<p>Error loading public games.</p>';
                return;
            }
            
            if (!data.games || data.games.length === 0) {
                container.innerHTML = '<p>No public games available.</p>';
                return;
            }
            
            // Filter out games where the current user is a participant
            const publicGames = data.games.filter(game => {
                return currentUsername !== game.white_player && 
                       currentUsername !== game.black_player;
            });
            
            if (publicGames.length === 0) {
                container.innerHTML = '<p>No public games available.</p>';
                return;
            }
            
            // Create table
            let html = '<table class="stats-table">';
            html += '<thead><tr><th>White Player</th><th>Black Player</th><th>Current Turn</th><th>Started</th><th>Action</th></tr></thead>';
            html += '<tbody>';
            
            publicGames.forEach(game => {
                html += `<tr>
                    <td>${game.white_player}</td>
                    <td>${game.black_player}</td>
                    <td>${game.turn === 'white' ? 'White' : 'Black'}</td>
                    <td>${game.start_date || 'N/A'}</td>
                    <td><button class="view-btn" data-game-id="${game.id}">View</button></td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            container.innerHTML = html;
            
            // Add event listeners to view buttons
            container.querySelectorAll('.view-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const gameId = this.getAttribute('data-game-id');
                    window.location.href = 'game.php?id=' + gameId;
                });
            });
        })
        .catch(error => {
            console.error('Error loading public games:', error);
            container.innerHTML = '<p>Error loading public games.</p>';
        });
}

// Initialize the user interface when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeUserInterface();
    
    // Set up periodic activity updates if logged in
    if (isLoggedIn()) {
        updateUserActivity();
        setInterval(updateUserActivity, 60000); // Update every minute
        
        // Load user's games if logged in
        loadUserGames();
    }
    
    // Load public games for everyone
    loadPublicGames();
}); 