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

// 報酬の計算
function getReward(winner, color) {
    if (winner === color) return 1.0;   // 勝ち
    if (winner === EMPTY) return 0.1;   // 引きわけ
    return -1.0                         // 負け
}

// 1ゲーム分の履歴からモデルを更新
async function trainOneGame(model, history, winner, gamma) {
    for (const { board, color, move, nextBoard } of history) {
        const reward = getReward(winner, color);
        const input =  boardToInput(board, color);
        const nextInput = boardToInput(nextBoard, color);

        const qTensor = model.predict(tf.tensor2d([input]));
        const qNext = model.predict(tf.tensor2d([nextInput]));

        const qVals = qTensor.dataSync();
        const qNextMax = Math.max(...qNext.dataSync());

        // Q値を更新 ( Bellman方程式 )
        const target = [...qVals];
        const idx = move[0] * SIZE + move[1];
        target[idx] = reward + gamma * qNextMax;

        // 学習
        await model.fit(
            tf.tensor2d([input]),
            tf.tensor2d([target]),
            { epochs: 1, verbose: 0 }
        );

        tf.dispose([qTensor, qNext]);
    }
}


// 動作確認
const model = createModel();
(async () => {
    const game = playOneGame(model, 1.0);
    await trainOneGame(model, game.history, game.winner, 0.95);
    console.log("DQN更新OK");
})();