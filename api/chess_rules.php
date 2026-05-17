<?php

function chess_initial_board() {
    $board = array_fill(0, 10, array_fill(0, 10, null));

    $board[0][0] = ['type' => 'dragon', 'color' => 'black'];
    $board[0][1] = ['type' => 'rook', 'color' => 'black'];
    $board[0][2] = ['type' => 'knight', 'color' => 'black'];
    $board[0][3] = ['type' => 'bishop', 'color' => 'black'];
    $board[0][4] = ['type' => 'queen', 'color' => 'black'];
    $board[0][5] = ['type' => 'king', 'color' => 'black'];
    $board[0][6] = ['type' => 'bishop', 'color' => 'black'];
    $board[0][7] = ['type' => 'knight', 'color' => 'black'];
    $board[0][8] = ['type' => 'rook', 'color' => 'black'];
    $board[0][9] = ['type' => 'dragon', 'color' => 'black'];

    for ($col = 0; $col < 10; $col++) {
        $board[1][$col] = ['type' => ($col === 4 || $col === 5) ? 'archer' : 'pawn', 'color' => 'black'];
        $board[8][$col] = ['type' => ($col === 4 || $col === 5) ? 'archer' : 'pawn', 'color' => 'white'];
    }

    $board[9][0] = ['type' => 'dragon', 'color' => 'white'];
    $board[9][1] = ['type' => 'rook', 'color' => 'white'];
    $board[9][2] = ['type' => 'knight', 'color' => 'white'];
    $board[9][3] = ['type' => 'bishop', 'color' => 'white'];
    $board[9][4] = ['type' => 'queen', 'color' => 'white'];
    $board[9][5] = ['type' => 'king', 'color' => 'white'];
    $board[9][6] = ['type' => 'bishop', 'color' => 'white'];
    $board[9][7] = ['type' => 'knight', 'color' => 'white'];
    $board[9][8] = ['type' => 'rook', 'color' => 'white'];
    $board[9][9] = ['type' => 'dragon', 'color' => 'white'];

    return $board;
}

function chess_piece_from_symbol($value) {
    if (!is_string($value) || $value === '') return null;
    $map = [
        '♔' => ['type' => 'king', 'color' => 'white'],
        '♚' => ['type' => 'king', 'color' => 'black'],
        '♕' => ['type' => 'queen', 'color' => 'white'],
        '♛' => ['type' => 'queen', 'color' => 'black'],
        '♖' => ['type' => 'rook', 'color' => 'white'],
        '♜' => ['type' => 'rook', 'color' => 'black'],
        '♗' => ['type' => 'bishop', 'color' => 'white'],
        '♝' => ['type' => 'bishop', 'color' => 'black'],
        '♘' => ['type' => 'knight', 'color' => 'white'],
        '♞' => ['type' => 'knight', 'color' => 'black'],
        '♙' => ['type' => 'pawn', 'color' => 'white'],
        '♟' => ['type' => 'pawn', 'color' => 'black'],
        '♙⇡' => ['type' => 'archer', 'color' => 'white'],
        '♟⇣' => ['type' => 'archer', 'color' => 'black'],
        'dragon-white' => ['type' => 'dragon', 'color' => 'white'],
        'dragon-black' => ['type' => 'dragon', 'color' => 'black']
    ];
    return $map[$value] ?? null;
}

function chess_normalize_piece($piece) {
    if (!$piece) return null;
    if (is_string($piece)) return chess_piece_from_symbol($piece);
    if (!is_array($piece)) return null;

    $type = isset($piece['type']) ? strtolower(trim((string)$piece['type'])) : '';
    $color = isset($piece['color']) ? strtolower(trim((string)$piece['color'])) : '';
    if (!in_array($type, ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn', 'archer', 'dragon'], true)) return null;
    if ($color !== 'white' && $color !== 'black') return null;
    return ['type' => $type, 'color' => $color];
}

function chess_board_from_state($board_state) {
    if (!$board_state || $board_state === 'initial_board_state') {
        return chess_initial_board();
    }

    $decoded = is_string($board_state) ? json_decode($board_state, true) : $board_state;
    if (!is_array($decoded)) {
        throw new Exception('Invalid board state');
    }

    $board = array_fill(0, 10, array_fill(0, 10, null));

    if (count($decoded) === 10 && isset($decoded[0]) && is_array($decoded[0]) && count($decoded[0]) === 10) {
        for ($row = 0; $row < 10; $row++) {
            for ($col = 0; $col < 10; $col++) {
                $board[$row][$col] = chess_normalize_piece($decoded[$row][$col] ?? null);
            }
        }
        return $board;
    }

    foreach ($decoded as $piece) {
        if (!is_array($piece)) continue;
        $row = isset($piece['row']) ? (int)$piece['row'] : -1;
        $col = isset($piece['col']) ? (int)$piece['col'] : -1;
        if (!chess_in_bounds($row, $col)) continue;
        $normalized = chess_normalize_piece($piece);
        if ($normalized) $board[$row][$col] = $normalized;
    }

    return $board;
}

function chess_board_to_pieces($board) {
    $pieces = [];
    for ($row = 0; $row < 10; $row++) {
        for ($col = 0; $col < 10; $col++) {
            if ($board[$row][$col]) {
                $pieces[] = [
                    'row' => $row,
                    'col' => $col,
                    'type' => $board[$row][$col]['type'],
                    'color' => $board[$row][$col]['color']
                ];
            }
        }
    }
    return $pieces;
}

function chess_in_bounds($row, $col) {
    return $row >= 0 && $row < 10 && $col >= 0 && $col < 10;
}

function chess_opponent($color) {
    return $color === 'white' ? 'black' : 'white';
}

function chess_path_clear($board, $from_row, $from_col, $to_row, $to_col) {
    $row_step = $from_row === $to_row ? 0 : ($to_row > $from_row ? 1 : -1);
    $col_step = $from_col === $to_col ? 0 : ($to_col > $from_col ? 1 : -1);
    $row = $from_row + $row_step;
    $col = $from_col + $col_step;

    while ($row !== $to_row || $col !== $to_col) {
        if ($board[$row][$col]) return false;
        $row += $row_step;
        $col += $col_step;
    }
    return true;
}

function chess_basic_move_info($board, $from_row, $from_col, $to_row, $to_col, $color) {
    if (!chess_in_bounds($from_row, $from_col) || !chess_in_bounds($to_row, $to_col)) {
        return ['valid' => false, 'message' => 'Move is off the board'];
    }

    $piece = $board[$from_row][$from_col];
    if (!$piece) return ['valid' => false, 'message' => 'No piece on that square'];
    if ($piece['color'] !== $color) return ['valid' => false, 'message' => 'That is not your piece'];

    $target = $board[$to_row][$to_col];
    if ($target && $target['color'] === $color) {
        return ['valid' => false, 'message' => 'Cannot capture your own piece'];
    }

    $row_diff = $to_row - $from_row;
    $col_diff = $to_col - $from_col;
    $abs_row = abs($row_diff);
    $abs_col = abs($col_diff);
    $archer_shot = false;
    $mid_capture = null;

    switch ($piece['type']) {
        case 'dragon':
            if ($abs_row > 2 || $abs_col > 2 || ($abs_row === 0 && $abs_col === 0)) {
                return ['valid' => false, 'message' => 'Invalid dragon move'];
            }
            if ($abs_row === 2 || $abs_col === 2) {
                if (!($abs_row === 0 || $abs_col === 0 || $abs_row === $abs_col)) {
                    return ['valid' => false, 'message' => 'Invalid dragon leap'];
                }
                $mid_row = (int)(($from_row + $to_row) / 2);
                $mid_col = (int)(($from_col + $to_col) / 2);
                $mid = $board[$mid_row][$mid_col];
                if ($mid && $mid['color'] === $color) {
                    return ['valid' => false, 'message' => 'Dragon path blocked by your piece'];
                }
                if ($mid && $mid['color'] !== $color && !$target) {
                    return ['valid' => false, 'message' => 'Dragon leap must land on a capture when jumping an enemy'];
                }
                if ($mid && $mid['color'] !== $color) {
                    $mid_capture = ['row' => $mid_row, 'col' => $mid_col];
                }
            }
            break;

        case 'queen':
            if (!($abs_row === 0 || $abs_col === 0 || $abs_row === $abs_col) || ($abs_row === 0 && $abs_col === 0)) {
                return ['valid' => false, 'message' => 'Invalid queen move'];
            }
            if (!chess_path_clear($board, $from_row, $from_col, $to_row, $to_col)) {
                return ['valid' => false, 'message' => 'Path is blocked'];
            }
            break;

        case 'rook':
            if (!(($abs_row === 0 || $abs_col === 0) && !($abs_row === 0 && $abs_col === 0))) {
                return ['valid' => false, 'message' => 'Invalid rook move'];
            }
            if (!chess_path_clear($board, $from_row, $from_col, $to_row, $to_col)) {
                return ['valid' => false, 'message' => 'Path is blocked'];
            }
            break;

        case 'bishop':
            if ($abs_row !== $abs_col || $abs_row === 0) {
                return ['valid' => false, 'message' => 'Invalid bishop move'];
            }
            if (!chess_path_clear($board, $from_row, $from_col, $to_row, $to_col)) {
                return ['valid' => false, 'message' => 'Path is blocked'];
            }
            break;

        case 'knight':
            if (!(($abs_row === 2 && $abs_col === 1) || ($abs_row === 1 && $abs_col === 2))) {
                return ['valid' => false, 'message' => 'Invalid knight move'];
            }
            break;

        case 'king':
            if ($abs_row > 1 || $abs_col > 1 || ($abs_row === 0 && $abs_col === 0)) {
                return ['valid' => false, 'message' => 'Invalid king move'];
            }
            break;

        case 'pawn':
        case 'archer':
            $direction = $color === 'white' ? -1 : 1;
            $start_row = $color === 'white' ? 8 : 1;
            if ($piece['type'] === 'archer' && $target && ($row_diff === $direction) && ($abs_col === 0 || $abs_col === 1)) {
                $archer_shot = true;
                break;
            }
            if (!$target && $abs_col === 0 && $row_diff === $direction) {
                break;
            }
            if (!$target && $abs_col === 0 && $row_diff === 2 * $direction && $from_row === $start_row) {
                if ($board[$from_row + $direction][$from_col]) {
                    return ['valid' => false, 'message' => 'Path is blocked'];
                }
                break;
            }
            if ($piece['type'] === 'pawn' && $target && $abs_col === 1 && $row_diff === $direction) {
                break;
            }
            return ['valid' => false, 'message' => 'Invalid pawn move'];

        default:
            return ['valid' => false, 'message' => 'Unknown piece'];
    }

    return [
        'valid' => true,
        'piece' => $piece,
        'target' => $target,
        'archer_shot' => $archer_shot,
        'mid_capture' => $mid_capture
    ];
}

function chess_apply_move_unchecked($board, $move_info, $from_row, $from_col, $to_row, $to_col) {
    $piece = $move_info['piece'];
    $king_captured = null;

    if ($move_info['archer_shot']) {
        if ($board[$to_row][$to_col] && $board[$to_row][$to_col]['type'] === 'king') {
            $king_captured = $board[$to_row][$to_col]['color'];
        }
        $board[$to_row][$to_col] = null;
        return ['board' => $board, 'king_captured' => $king_captured, 'promoted' => false];
    }

    if ($move_info['target'] && $move_info['target']['type'] === 'king') {
        $king_captured = $move_info['target']['color'];
    }
    if ($move_info['mid_capture']) {
        $mid = $move_info['mid_capture'];
        if ($board[$mid['row']][$mid['col']] && $board[$mid['row']][$mid['col']]['type'] === 'king') {
            $king_captured = $board[$mid['row']][$mid['col']]['color'];
        }
        $board[$mid['row']][$mid['col']] = null;
    }

    $board[$from_row][$from_col] = null;
    $promoted = false;
    if (($piece['type'] === 'pawn' || $piece['type'] === 'archer') &&
        (($piece['color'] === 'white' && $to_row === 0) || ($piece['color'] === 'black' && $to_row === 9))) {
        $piece['type'] = 'queen';
        $promoted = true;
    }
    $board[$to_row][$to_col] = $piece;

    return ['board' => $board, 'king_captured' => $king_captured, 'promoted' => $promoted];
}

function chess_find_king($board, $color) {
    for ($row = 0; $row < 10; $row++) {
        for ($col = 0; $col < 10; $col++) {
            $piece = $board[$row][$col];
            if ($piece && $piece['type'] === 'king' && $piece['color'] === $color) {
                return [$row, $col];
            }
        }
    }
    return null;
}

function chess_square_attacked_by($board, $row, $col, $attacker_color) {
    $knights = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    foreach ($knights as $offset) {
        $r = $row + $offset[0]; $c = $col + $offset[1];
        if (chess_in_bounds($r, $c) && $board[$r][$c] && $board[$r][$c]['color'] === $attacker_color && $board[$r][$c]['type'] === 'knight') return true;
    }

    $forward = $attacker_color === 'white' ? 1 : -1;
    $pawn_row = $row + $forward;
    foreach ([-1, 1] as $dc) {
        $c = $col + $dc;
        if (chess_in_bounds($pawn_row, $c) && $board[$pawn_row][$c] && $board[$pawn_row][$c]['color'] === $attacker_color && in_array($board[$pawn_row][$c]['type'], ['pawn', 'archer'], true)) return true;
    }
    if (chess_in_bounds($pawn_row, $col) && $board[$pawn_row][$col] && $board[$pawn_row][$col]['color'] === $attacker_color && $board[$pawn_row][$col]['type'] === 'archer') return true;

    $dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    foreach ($dirs as $d) {
        $r = $row + $d[0]; $c = $col + $d[1];
        if (chess_in_bounds($r, $c) && $board[$r][$c] && $board[$r][$c]['color'] === $attacker_color && in_array($board[$r][$c]['type'], ['king', 'dragon'], true)) return true;
    }
    foreach ($dirs as $d) {
        $r = $row + 2 * $d[0]; $c = $col + 2 * $d[1];
        if (!chess_in_bounds($r, $c)) continue;
        $piece = $board[$r][$c];
        if ($piece && $piece['color'] === $attacker_color && $piece['type'] === 'dragon') {
            $mid = $board[$row + $d[0]][$col + $d[1]];
            if (!($mid && $mid['color'] === $attacker_color)) return true;
        }
    }

    foreach ([[1,0],[-1,0],[0,1],[0,-1]] as $d) {
        $r = $row + $d[0]; $c = $col + $d[1];
        while (chess_in_bounds($r, $c)) {
            $piece = $board[$r][$c];
            if ($piece) {
                if ($piece['color'] === $attacker_color && in_array($piece['type'], ['rook', 'queen'], true)) return true;
                break;
            }
            $r += $d[0]; $c += $d[1];
        }
    }

    foreach ([[1,1],[1,-1],[-1,1],[-1,-1]] as $d) {
        $r = $row + $d[0]; $c = $col + $d[1];
        while (chess_in_bounds($r, $c)) {
            $piece = $board[$r][$c];
            if ($piece) {
                if ($piece['color'] === $attacker_color && in_array($piece['type'], ['bishop', 'queen'], true)) return true;
                break;
            }
            $r += $d[0]; $c += $d[1];
        }
    }

    return false;
}

function chess_is_king_in_check($board, $color) {
    $king = chess_find_king($board, $color);
    if (!$king) return false;
    return chess_square_attacked_by($board, $king[0], $king[1], chess_opponent($color));
}

function chess_has_legal_move($board, $color) {
    for ($from_row = 0; $from_row < 10; $from_row++) {
        for ($from_col = 0; $from_col < 10; $from_col++) {
            $piece = $board[$from_row][$from_col];
            if (!$piece || $piece['color'] !== $color) continue;
            for ($to_row = 0; $to_row < 10; $to_row++) {
                for ($to_col = 0; $to_col < 10; $to_col++) {
                    $info = chess_basic_move_info($board, $from_row, $from_col, $to_row, $to_col, $color);
                    if (!$info['valid']) continue;
                    $applied = chess_apply_move_unchecked($board, $info, $from_row, $from_col, $to_row, $to_col);
                    if (!chess_is_king_in_check($applied['board'], $color)) return true;
                }
            }
        }
    }
    return false;
}

function chess_is_checkmate($board, $color) {
    return chess_is_king_in_check($board, $color) && !chess_has_legal_move($board, $color);
}

function chess_is_stalemate($board, $color) {
    return !chess_is_king_in_check($board, $color) && !chess_has_legal_move($board, $color);
}

function chess_square_name($row, $col) {
    $files = 'ABCDEFGHIJ';
    return substr($files, $col, 1) . (10 - $row);
}

function chess_move_summary($piece, $from_row, $from_col, $to_row, $to_col, $archer_shot) {
    $names = [
        'king' => 'King',
        'queen' => 'Queen',
        'rook' => 'Rook',
        'bishop' => 'Bishop',
        'knight' => 'Knight',
        'pawn' => 'Pawn',
        'archer' => 'Archer',
        'dragon' => 'Dragon'
    ];
    $name = $names[$piece['type']] ?? 'Piece';
    $verb = $archer_shot ? ' shot ' : ' ';
    return $name . $verb . chess_square_name($from_row, $from_col) . ' -> ' . chess_square_name($to_row, $to_col);
}

function chess_validate_and_apply_move($board_state, $from_row, $from_col, $to_row, $to_col, $color) {
    $board = chess_board_from_state($board_state);
    $move_info = chess_basic_move_info($board, $from_row, $from_col, $to_row, $to_col, $color);
    if (!$move_info['valid']) {
        throw new Exception($move_info['message']);
    }

    $applied = chess_apply_move_unchecked($board, $move_info, $from_row, $from_col, $to_row, $to_col);
    if (!$applied['king_captured'] && chess_is_king_in_check($applied['board'], $color)) {
        throw new Exception('That move would leave your king in check');
    }

    $next_turn = chess_opponent($color);
    $special_status = null;
    $is_complete = false;
    $result = null;
    $winner_color = null;

    if ($applied['king_captured']) {
        $special_status = 'checkmate';
        $is_complete = true;
        $result = 'checkmate';
        $winner_color = $color;
    } else if (chess_is_checkmate($applied['board'], $next_turn)) {
        $special_status = 'checkmate';
        $is_complete = true;
        $result = 'checkmate';
        $winner_color = $color;
    } else if (chess_is_king_in_check($applied['board'], $next_turn)) {
        $special_status = 'check';
    } else if (chess_is_stalemate($applied['board'], $next_turn)) {
        $special_status = 'stalemate';
        $is_complete = true;
        $result = 'draw';
    } else if ($applied['promoted']) {
        $special_status = 'promotion';
    }

    return [
        'board' => $applied['board'],
        'board_state' => json_encode(chess_board_to_pieces($applied['board'])),
        'next_turn' => $next_turn,
        'special_status' => $special_status,
        'is_complete' => $is_complete,
        'result' => $result,
        'winner_color' => $winner_color,
        'last_move' => chess_move_summary($move_info['piece'], $from_row, $from_col, $to_row, $to_col, $move_info['archer_shot'])
    ];
}

?>
