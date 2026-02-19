// 盤面定数
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const SIZE = 8;

const DIRS = [
    [-1,-1], [-1, 0], [-1, 1],
    [ 0,-1],          [ 0, 1],
    [ 1,-1], [ 1, 0], [ 1, 1]
];

// 初期盤面を生成
function createBoard() {
    const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    // オセロの初期配置
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    return board;
}

// 盤面を描画
function drawBoard(canvas, board) {
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const cell = size / SIZE;

    // 背景
    ctx.fillStyle = "#1a3a2a";
    ctx.fillRect(0, 0, size, size);

    // グリッド線
    ctx.strokeStyle = "#2a5a3a";
    ctx.lineWidth = 1;
    for (let i = 0; i <= SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(size, i * cell);
        ctx.stroke();
    }

    // 石を描画
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === EMPTY) continue;

            const x = c * cell + cell / 2;
            const y = r * cell + cell / 2;
            const radius = cell * 0.4;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = board[r][c] === BLACK ? "#1a1a1a" : "#e8ede6";
            ctx.fill();
        }
    }
}

// 指定された手が範囲内かどうか
function inBounds(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

// 指定された手が次に打てる手かどうか判定
function canPlace(board, row, col, color) {
    if (board[row][col] !== EMPTY) return false;

    const opp = color === BLACK ? WHITE : BLACK;

    for (const [dr, dc] of DIRS) {
        let r = row + dr;
        let c = col + dc;
        let count = 0;

        while (inBounds(r, c) && board[r][c] === opp) {
            r += dr;
            c += dc;
            count++;
        }

        // 1つ以上相手の石を挟んで自分の石があれば合法
        if (count > 0 && inBounds(r, c) && board[r][c] === color) {
            return true;
        }
    }

    return false;
}

// 次に打てる手の一覧を返す
function getAvailableMoves(board, color) {
    const moves = [];
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (canPlace(board, r, c, color)) moves.push([r, c]);
        }
    }

    return moves;
}

function applyMove(board, row, col, color) {
    const opp = color === BLACK ? WHITE : BLACK;

    // copy
    const next = board.map(r => [...r]);
    next[row][col] = color;

    for (const [dr, dc] of DIRS) {
        let r = row + dr;
        let c = col + dc;
        const toFlip = [];

        while (inBounds(r, c) && next[r][c] === opp) {
            toFlip.push([r, c]);
            r += dr;
            c += dc;
        }

        // 端が自分の石なら返す
        if (toFlip.length > 0 && inBounds(r, c) && next[r][c] === color) {
            for (const [fr, fc] of toFlip) {
                next[fr][fc] = color;
            }
        }
    }

    return next;
}

// スコア計算
function getScore(board) {
    let black = 0;
    let white = 0;
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === BLACK) black++;
            if (board[r][c] === WHITE) white++;
        }
    }

    return { black, white };
}

// ゲームの終了判定
function isGameOver(board) {
    const blackMoves = getAvailableMoves(board, BLACK);
    const whiteMoves = getAvailableMoves(board, WHITE);
    return blackMoves.length === 0 && whiteMoves.length === 0;
}

// 勝者を返す
function getWinner(board) {
    const { black, white } = getScore(board);
    if (black > white) return BLACK;
    if (white > black) return WHITE;
    return EMPTY;
}


// 初期描画
const board = createBoard();
const canvas = document.getElementById("board-canvas");
drawBoard(canvas, board);


// 動作確認