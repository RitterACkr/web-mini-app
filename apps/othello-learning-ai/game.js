// 盤面定数
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const SIZE = 8;

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

// 初期描画
const board = createBoard();
const canvas = document.getElementById("board-canvas");
drawBoard(canvas, board);