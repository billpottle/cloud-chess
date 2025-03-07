// Main initialization code
document.addEventListener('DOMContentLoaded', function () {


    // Load game data
    loadGameStats();
    loadPlayerRankings();

    // Set up event listeners for game mode buttons
    document.getElementById('vs-player').addEventListener('click', function () {
        updateGameStats('Player Vs Player (Local)');
        // Existing code to start the game
    });

    document.getElementById('computer-difficulty').addEventListener('change', function () {
        const level = this.value;
        if (level) {
            updateGameStats('Vs Computer Level ' + level);
            // Existing code to start the game
        }
    });

    // Set up ranking sort change handler
    document.getElementById('ranking-sort').addEventListener('change', function () {
        loadPlayerRankings(this.value);
    });

    // Set up rules modal
    document.getElementById('rules-link').addEventListener('click', function (e) {
        e.preventDefault();
        document.getElementById('rules-modal').style.display = 'block';
    });

    document.querySelector('#rules-modal .close-modal').addEventListener('click', function () {
        document.getElementById('rules-modal').style.display = 'none';
    });

    // Close modals when clicking outside
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Set up periodic tasks
    if (window.currentUserId) {
        // Load user games if logged in
        loadUserGames();
        setInterval(loadUserGames, 30000);

        // Check for challenges
        checkPendingChallenges();
        setInterval(checkPendingChallenges, 30000);

        // Update user activity
        updateUserActivity();
        setInterval(updateUserActivity, 60000);
    }

    // Load active users
    loadActiveUsers();
    setInterval(loadActiveUsers, 30000);


    const myGamesSection = document.getElementById('my-games-section');
    if (myGamesSection) {
        myGamesSection.style.display = 'block';

        // Force reload of games if they weren't loaded initially
        if (myGamesSection.querySelector('#my-games-container').children.length <= 1) {
            loadUserGames();
        }
    }

}); 