// Function to load game statistics
function loadGameStats() {
    fetch('api/get_game_stats.php')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const container = document.getElementById('game-stats-container');
                
                // Create table
                let html = '<table class="stats-table">';
                html += '<thead><tr><th>Game Type</th><th>Games Played</th></tr></thead>';
                html += '<tbody>';
                
                if (Array.isArray(data.stats)) {
                    // Handle array format
                    data.stats.forEach(stat => {
                        html += `<tr>
                            <td>${stat.game_type}</td>
                            <td>${stat.number}</td>
                        </tr>`;
                    });
                } else {
                    // Handle object format
                    for (const [gameType, count] of Object.entries(data.stats)) {
                        html += `<tr><td>${gameType}</td><td>${count}</td></tr>`;
                    }
                }
                
                html += '</tbody></table>';
                container.innerHTML = html;
            } else {
                document.getElementById('game-stats-container').innerHTML = 
                    '<p>Unable to load game statistics.</p>';
            }
        })
        .catch(error => {
            console.error('Error loading game stats:', error);
            document.getElementById('game-stats-container').innerHTML = 
                '<p>Error loading game statistics.</p>';
        });
}

// Function to load player rankings
function loadPlayerRankings(sortBy = 'elo') {
    const url = sortBy ? `api/get_top_players.php?sort_by=${sortBy}` : 'api/get_top_players.php';
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const container = document.getElementById('player-rankings-container');
                
                if (!data.players || data.players.length === 0) {
                    container.innerHTML = '<p>No player rankings available.</p>';
                    return;
                }
                
                // Create table
                let html = '<table class="stats-table">';
                html += '<thead><tr><th>Rank</th><th>Player</th><th>ELO</th><th>Wins</th><th>Losses</th></tr></thead>';
                html += '<tbody>';
                
                data.players.forEach((player, index) => {
                    const isCurrentUser = window.currentUserId && window.currentUserId == player.id;
                    const rowClass = isCurrentUser ? 'class="current-user"' : '';
                    
                    html += `<tr ${rowClass}>
                        <td>${index + 1}</td>
                        <td>${player.username}</td>
                        <td>${player.elo}</td>
                        <td>${player.wins || 0}</td>
                        <td>${player.losses || 0}</td>
                    </tr>`;
                });
                
                html += '</tbody></table>';
                container.innerHTML = html;
            } else {
                document.getElementById('player-rankings-container').innerHTML = 
                    '<p>Unable to load player rankings.</p>';
            }
        })
        .catch(error => {
            console.error('Error loading player rankings:', error);
            document.getElementById('player-rankings-container').innerHTML = 
                '<p>Error loading player rankings.</p>';
        });
} 