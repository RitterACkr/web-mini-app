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

// 動作確認用
const board = createBoard();
console.log("初期盤面:", board);