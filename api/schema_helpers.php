<?php

function ensure_column_exists($conn, $table, $column, $definition) {
    $safe_table = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safe_column = preg_replace('/[^a-zA-Z0-9_]/', '', $column);

    if ($safe_table === '' || $safe_column === '') {
        throw new Exception('Invalid schema identifier');
    }

    $safe_column_value = $conn->real_escape_string($safe_column);
    $result = execute_query($conn, "SHOW COLUMNS FROM `$safe_table` LIKE '$safe_column_value'");
    $exists = $result && $result->num_rows > 0;

    if (!$exists) {
        execute_query($conn, "ALTER TABLE `$safe_table` ADD COLUMN `$safe_column` $definition");
    }
}

function ensure_multiplayer_schema($conn) {
    ensure_column_exists($conn, 'users', 'draws', 'INT NOT NULL DEFAULT 0');
    ensure_column_exists($conn, 'challenges', 'move_time_limit_seconds', 'INT NOT NULL DEFAULT 86400');
    ensure_column_exists($conn, 'games', 'move_time_limit_seconds', 'INT NOT NULL DEFAULT 86400');
}

?>
