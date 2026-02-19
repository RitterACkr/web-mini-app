// 入力: 8x8x3 (自分の石・相手の石・合法手) = 192 dimensions
// 出力: 64マス分のQ値

function createModel() {
    const model = tf.sequential();

    // 入力層 -> 隠れ層1
    model.add(tf.layers.dense({
        inputShape: [192],
        units: 128,
        activation: "relu"
    }));

    // 隠れ層2
    model.add(tf.layers.dense({
        units: 64,
        activation: "relu"
    }));

    // 出力層
    model.add(tf.layers.dense({
        units: 64,
        activation: "linear"
    }));

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: "meanSquaredError"
    });

    return model;
}


// 盤面を192次元のベクトルに変換
// [自分の石(64), 相手の石(64), 打てる手(64)] の順
function boardToInput(board, color) {
    const opp = color === BLACK ? WHITE : BLACK;
    const place = getAvailableMoves(board, color);
    const placeSet = new Set(place.map(([r, c]) => r * SIZE + c));

    const mine = [];
    const theirs = [];
    const moves = [];

    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            mine.push(board[r][c] === color ? 1 : 0);
            theirs.push(board[r][c] === opp ? 1 : 0);
            moves.push(placeSet.has(r * SIZE + c) ? 1 : 0);
        }
    }

    return [...mine, ...theirs, ...moves];
}


// 動作確認
const model = createModel();
model.summary();
console.log("NNモデル作成");

const input = boardToInput(board, BLACK);
console.log("入力ベクトル長: ", input.length);
console.log("先頭16要素: ", input.slice(0, 16));