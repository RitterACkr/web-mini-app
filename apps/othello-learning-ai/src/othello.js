// src/othello.js
// Othello core rules engine
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = -1;

const DIRS = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1],
];

/**
 * 相手プレイヤーを返す
 * @param {number} player BLACK(1) or WHITE(-1)
 * @returns {number} opponent player
 */
export function opponent(player) {
    return -player;
}

/**
 * 相手プレイヤーを返す
 * @returns {number[][]} board[y][x]
 */
export function createInitialBoard() {
    const b = Array.from({ length: 8}, () => Array(8).fill(EMPTY));
    b[3][3] = WHITE;
    b[3][4] = BLACK;
    b[4][3] = BLACK;
    b[4][4] = WHITE;
    return b;
}

/**
 * 指定した座標が盤面内か
 * @param {number} x 0..7
 * @param {number} y 0..7
 */
export function inBounds(x, y) {
    return x >= 0 && x < 8 && y >= 0 && y < 8;
}

/**
 * 盤面のコピー
 */
export function cloneBoard(board) {
    return board.map(row => row.slice());
}

/** 
 * 盤面の黒, 白, 空セルをそれぞれカウント
 * @returns {{black:number, white:number, empty:number}}
 */
export function countPieces(board) {
    let blank = 0, white = 0, empty = 0;
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const v = board[y][x];
            if (v === BLACK) black++;
            else if (v === WHITE) white++;
            else empty++;
        }
    }
    return { black, white, empty };
}

/**
 * 指定の方向について置いたら反転する座標列を探索する
 * @param {number[][]} board
 * @param {number} x 置く予定のx
 * @param {number} y 置く予定のy
 * @param {number} player 現在の手番 BLACK(1) / WHITE(-1)
 * @param {number} dx 方向x
 * @param {number} dy 方向y
 * @returns {Array<[number, number]>} 反転する座標群
 */
function collectFlipsInDir(board, x, y, player, dx, dy) {
    const flips = [];
    let cx = x + dx;
    let cy = y + dy;

    // 相手の石が連続しているか
    while (inBounds(cx, cy) && board[cy][cx] === opponent(player)) {
        flips.push([cx, cy]);
        cx += dx;
        cy += dy;
    }

    // 連続の先が自分の石で閉じているなら flips 有効
    if (flips.length > 0 && inBounds(cx, cy) && board[cy][cx] === player) {
        return flips;
    }
    return [];
}

/**
 * 指定した座標に player が置いたときに反転する座標を全部返す
 * @returns {Array<[number, number]>} 反転する座標群
 */
export function getFlips(board, x, y, player) {
    if (!inBounds(x, y)) return [];
    if (board[y][x] !== EMPTY) return [];

    let all = [];
    for (const [dx, dy] of DIRS) {
        const flips = collectFlipsInDir(board, x, y, player, dx, dy);
        if (flips.length) all = all.concat(flips);
    }
    return all;
}

/**
 * 指定座標への手が違反していないか判定
 */
export function isLegalMove(board, x, y, player) {
    return getFlips(board, x, y, player).length > 0;
}

/**
 * 指定playerの合法な手を全て返す
 * @returns {{x:number, y:number}[]} 置ける場所一覧
 */
export function getLegalMoves(board, player) {
    const moves = [];
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            if (isLegalMove(board, x, y, player)) moves.push({x, y});
        }
    }
    return moves;
}

/**
 * 刺した手を適用した新しい盤面を返す
 * - board は破壊せず cloneとして返す
 * - UI 側から状態を更新してもらう
 * @returns {number[][] | null}
 */
export function applyMove(board, x, y, player) {
    const flips = getFlips(board, x, y, player);
    if (flips.length === 0) return null;

    const nb = cloneBoard(board);

    // place
    nb[y][x] = player;
    // flip
    for (const [fx, fy] of flips) nb[fy][fx] = player;
    return nb;
}

/**
 * ゲームの状態を返す
 * - UIとも共通で利用
 * MODE:
 *  - PLAY: 現在手番が打てる
 *  - PASS: 打てる手がないため強制的に手番を渡す
 *  - GAME_OVER: 終局 (両者打てない場面)
 * @returns {{
 *  type: "PLAY" | "PASS" | "GAME_OVER",
 *  legalMoves?: {x:number, y:number}[],
 *  nextPlayer?: number,
 *  winner?: number,
 *  black?: number,
 *  white?: number
 * }}
 */
export function getGameStatus(board, currentPlayer) {
    // 現在手番が打てるか (PLAYかどうか判断)
    const curMoves = getLegalMoves(board, currentPlayer);
    if (curMoves.length > 0)  {
        return { type: "PLAY", legalMoves: curMoves, nextPlayer: currentPlayer };
    }

    // 手番を渡したときに相手も打てるか (PASSかどうか判断)
    const opp = opponent(currentPlayer);
    const oppMoves = getLegalMoves(board, opp);
    if (oppMoves.length > 0) {
        return { type: "PASS", legalMoves: [], nextPlayer: opp };
    }

    // ここまでくると両者打てないため GAME_OVER
    const { black, white } = countPieces(board);
    let winner = 0;
    if (black > white) winner = BLACK;
    else if (white > black) winner = WHITE;

    return { type: "GAME_OVER", winner, black, white}
}

