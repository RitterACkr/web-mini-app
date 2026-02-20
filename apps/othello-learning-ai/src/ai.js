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

// Main Model
const model = createModel();
// Snapshot Model
let snapshotModel = createModel();

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
    const inputT = tf.tensor2d([input]);
    const predT = model.predict(inputT);
    const qVals = predT.dataSync();

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

    tf.dispose([inputT, predT]);
    return bestMove;
}

// 1ゲーム分の自己対戦を実行して履歴を返す
// mainModel = 学習結果となるモデル
// oppModel = snapshotモデル
function playOneGame(mainModel, oppModel, epsilon, epoch) {
    let board = createBoard();
    let color = BLACK;
    const history = [];

    const mainColor = epoch % 2 === 0 ? BLACK : WHITE;

    while (!isGameOver(board)) {
        const place = getAvailableMoves(board, color);

        // パスの処理
        if (place.length === 0) {
            color = color === BLACK ? WHITE : BLACK;
            continue;
        }

        const activeModel = color === mainColor ? mainModel : oppModel;
        const move = selectAction(activeModel, board, color, epsilon);
        const nextBoard = applyMove(board, move[0], move[1], color);

        if (color === mainColor) {
            const scoreBefore = getScore(board);
            const scoreAfter = getScore(nextBoard);

            const diffBefore = mainColor === BLACK
                ? scoreBefore.black - scoreBefore.white
                : scoreBefore.white - scoreBefore.black;

            const diffAfter = mainColor === BLACK
                ? scoreAfter.black - scoreAfter.white
                : scoreAfter.white - scoreAfter.black;

            // 石の数差の変化を正規化
            const midReward = (diffAfter - diffBefore) / 64;

            history.push({ board, color, move, nextBoard, midReward });
        }

        board = nextBoard;
        color = color === BLACK ? WHITE : BLACK;
    }

    const winner = getWinner(board);
    history.forEach((h,i) => {
        h.stepFromEnd = history.length - 1 - i;
    });
    return { history, winner, finalBoard: board, mainColor };
}

// 報酬の計算
function getReward(winner, color) {
    if (winner === color) return 1.0;   // 勝ち
    if (winner === EMPTY) return 0.1;   // 引きわけ
    return -1.0                         // 負け
}

// バッチから学習
async function trainBatch(model, batch, gamma) {
    for (const { board, color, move, midReward, winner, mainColor, stepFromEnd } of batch) {
        const finalReward = getReward(winner, mainColor);
        const discounted = finalReward * Math.pow(gamma, stepFromEnd);
        const combinedG = discounted + midReward * 0.3;

        const inputT = tf.tensor2d([boardToInput(board, color)]);
        const qTensor = model.predict(inputT);
        const qVals = [...qTensor.dataSync()];

        const idx = move[0] * SIZE + move[1];
        qVals[idx] = combinedG;

        const targetT = tf.tensor2d([qVals]);
        await model.fit(inputT, targetT, { epochs: 1, verbose: 0 });

        tf.dispose([inputT, qTensor, targetT]);
    }
}


// Experience Replay バッファ
const replayBuffer = {
    data: [],
    maxSize: 2000,

    // 経験の追加
    push(experiences) {
        for (const exp of experiences) {
            this.data.push(exp);
            if (this.data.length > this.maxSize) {
                this.data.shift();
            }
        }
    },

    // ランダムに${batchSize}件 サンプリング
    sample(batchSize) {
        const shuffled = [...this.data].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(batchSize, this.data.length));
    },

    get size() { return this.data.length; }
};

// 学習状態の管理
const trainingState = {
    isRunning: false,
    isPaused: false,
    epoch: 0,
    totalEpochs: 100,
    epsilon: 0.3,
    gamma: 0.95,
    snapshotInterval: 20,
    results: [],
};

// スナップショットを更新
async function updateSnapshot() {
    const weights = model.getWeights().map(w => w.clone());
    snapshotModel.setWeights(weights);
    console.log(`snapshot更新 @ epoch ${trainingState.epoch}`);
}

// 学習ループ
async function trainLoop(onEpochEnd) {
    trainingState.isRunning = true;

    // snapshotの無効化
    await updateSnapshot();

    while (trainingState.isRunning && trainingState.epoch < trainingState.totalEpochs) {
        // 一時停止確認
        if (trainingState.isPaused) {
            await new Promise(r => setTimeout(r, 200));
            continue;
        }

        const epsilon = trainingState.epsilon;
        const gamma = trainingState.gamma;

        // 1ゲーム実行 -> 学習
        const game = playOneGame(model, snapshotModel, epsilon, trainingState.epoch);

        replayBuffer.push(game.history.map(h => ({
            ...h,
            winner: game.winner,
            mainColor: game.mainColor,
        })));

        // バッファが32件以上たまったらバッチ学習
        if (replayBuffer.size >= 32) {
            const batch = replayBuffer.sample(32);
            await trainBatch(model, batch, gamma);
        }

        trainingState.epoch++;
        trainingState.results.push({
            epoch: trainingState.epoch,
            winner: game.winner,
            mainColor: game.mainColor,
        });

        if (trainingState.epoch % trainingState.snapshotInterval === 0) {
            await updateSnapshot();
        }

        // εを少しずつ減少
        trainingState.epsilon = Math.max(0.05, trainingState.epsilon * 0.995);

        // コールバックで外部に通知
        if (onEpochEnd) onEpochEnd(trainingState, game.finalBoard);

        // UIをブロックしないように少し待つ
        await new Promise(r => setTimeout(r, 0));
    }

    trainingState.isRunning = false;
    console.log("学習完了");
}


// 動作確認