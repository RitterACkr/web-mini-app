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

// NNでQ値を予測して手を選ぶ
function selectAction(model, board, color, epsilon) {
    const place = getAvailableMoves(board, color);
    if (place.length === 0) return null;

    // ε-greedy: ランダム探索
    if (Math.random() < epsilon) {
        return place[Math.floor(Math.random() * place.length)];
    }

    // NNでQ値を予測
    const input = boardToInput(board, color);
    const tensor = tf.tensor2d([input]);
    const qVals = model.predict(tensor).dataSync();
    tensor.dispose();

    // 打てる手の中でQ値が最大の手を選ぶ
    let bestMove = null;
    let bestScore = -Infinity;

    for (const [r, c] of place) {
        const q = qVals[r * SIZE + c];
        if (q > bestScore) {
            bestScore = q;
            bestMove = [r, c];
        }
    }

    return bestMove;
}

// 1ゲーム分の自己対戦を実行して履歴を返す
function playOneGame(model, epsilon) {
    let board = createBoard();
    let color = BLACK;
    const history = [];

    while (!isGameOver(board)) {
        const place = getAvailableMoves(board, color);

        // パスの処理
        if (place.length === 0) {
            color = color === BLACK ? WHITE : BLACK;
            continue;
        }

        const move = selectAction(model, board, color, epsilon);
        const nextBoard = applyMove(board, move[0], move[1], color);

        history.push({ board, color, move, nextBoard });

        board = nextBoard;
        color = color === BLACK ? WHITE : BLACK;
    }

    const winner = getWinner(board);
    return { history, winner, finalBoard: board };
}


// 動作確認
const model = createModel();
const game = playOneGame(model, 1.0);
console.log("勝者:", game.winner === BLACK ? "黒" : game.winner === WHITE ? "白" : "引き分け");
console.log("手数:", game.history.length);