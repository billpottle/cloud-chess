<?php

function calculate_new_elo_for_result($player_elo, $opponent_elo, $result) {
    $k_factor = 32;
    $expected = 1 / (1 + pow(10, ($opponent_elo - $player_elo) / 400));
    return max(100, round($player_elo + $k_factor * ($result - $expected)));
}

function complete_game_with_result($conn, $game, $result, $winner_color = null) {
    $game_id = (int)$game['id'];
    $winner_username = null;
    $loser_username = null;
    $elo_changes = null;

    if ($winner_color === 'white' || $winner_color === 'black') {
        $winner_username = $winner_color === 'white' ? $game['white_player'] : $game['black_player'];
        $loser_username = $winner_color === 'white' ? $game['black_player'] : $game['white_player'];

        $safe_winner = $conn->real_escape_string($winner_username);
        $safe_loser = $conn->real_escape_string($loser_username);
        $query = "SELECT username, elo, wins, losses FROM users WHERE username IN ('$safe_winner', '$safe_loser')";
        $result_users = execute_query($conn, $query);

        $winner_elo = 1200;
        $loser_elo = 1200;
        $winner_wins = 1;
        $loser_losses = 1;

        while ($user_row = $result_users->fetch_assoc()) {
            if ($user_row['username'] === $winner_username) {
                $winner_elo = (int)$user_row['elo'];
                $winner_wins = (int)$user_row['wins'] + 1;
            } else {
                $loser_elo = (int)$user_row['elo'];
                $loser_losses = (int)$user_row['losses'] + 1;
            }
        }

        $winner_new_elo = calculate_new_elo_for_result($winner_elo, $loser_elo, 1);
        $loser_new_elo = calculate_new_elo_for_result($loser_elo, $winner_elo, 0);

        execute_query($conn, "UPDATE users SET elo = $winner_new_elo, wins = $winner_wins WHERE username = '$safe_winner'");
        execute_query($conn, "UPDATE users SET elo = $loser_new_elo, losses = $loser_losses WHERE username = '$safe_loser'");

        $elo_changes = [
            'winner' => [
                'username' => $winner_username,
                'old_elo' => $winner_elo,
                'new_elo' => $winner_new_elo,
                'change' => $winner_new_elo - $winner_elo,
                'wins' => $winner_wins
            ],
            'loser' => [
                'username' => $loser_username,
                'old_elo' => $loser_elo,
                'new_elo' => $loser_new_elo,
                'change' => $loser_new_elo - $loser_elo,
                'losses' => $loser_losses
            ]
        ];
    }

    if ($result === 'draw') {
        $white_player = $conn->real_escape_string($game['white_player']);
        $black_player = $conn->real_escape_string($game['black_player']);
        execute_query($conn, "UPDATE users SET draws = draws + 1 WHERE username IN ('$white_player', '$black_player')");
    }

    $winner_column = $winner_username ? "'" . $conn->real_escape_string($winner_username) . "'" : "NULL";
    $winner_elo_change = $elo_changes ? (int)$elo_changes['winner']['change'] : 0;
    $loser_elo_change = $elo_changes ? (int)$elo_changes['loser']['change'] : 0;
    $end_timestamp = time();
    $safe_result = $conn->real_escape_string($result);

    execute_query($conn, "UPDATE games SET
        is_complete = TRUE,
        result = '$safe_result',
        winner = $winner_column,
        end_timestamp = $end_timestamp,
        last_move_timestamp = $end_timestamp,
        winner_elo_change = $winner_elo_change,
        loser_elo_change = $loser_elo_change
        WHERE id = $game_id");

    return [
        'success' => true,
        'message' => 'Game finalized successfully',
        'game_id' => $game_id,
        'result' => $result,
        'elo_changes' => $elo_changes
    ];
}

?>
