// タブの切り替え
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        // activeクラスをボタンから外す
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // sectionの切り替え
        document.querySelectorAll(".tab-content").forEach(sec => {
            sec.style.display = "none";
        });
        const target = document.getElementById("tab-" + btn.dataset.tab);
        if (target) target.style.display = "block";

        // View NN を開いたときの処理
        if (btn.dataset.tab === "network") {
            const w = extractWeights(model);
            const acts = extractActivations(model, createBoard(), BLACK);
            resizeAndDraw(w, acts);
        }
    })
});

// UI要素
/* Training Mode */
const btnStart = document.getElementById("btn-start");
const btnPause = document.getElementById("btn-pause");
const btnReset = document.getElementById("btn-reset");

const progBar = document.getElementById("progress-bar");
const progEpoch = document.getElementById("prog-epoch");
const progTotal = document.getElementById("prog-total");
const progPct = document.getElementById("prog-pct");

const statMain = document.getElementById("stat-main");
const statOpp = document.getElementById("stat-opp");
const statDraw = document.getElementById("stat-draw");

const boardStatus = document.getElementById("board-status");
const boardCanvas = document.getElementById("board-canvas");

const chartCanvas = document.getElementById("chart-canvas");

/* Battle Mode */
const battleCanvas = document.getElementById("battle-canvas");
const battleStatus = document.getElementById("battle-status");
const battleLog = document.getElementById("battle-log");
const scoreBlack = document.getElementById("score-black");
const scoreWhite = document.getElementById("score-white");
const btnBattleStart = document.getElementById("btn-battle-start");
const btnBattleReset = document.getElementById("btn-battle-reset");

const battleState = {
    board: null,
    playerColor: BLACK,
    aiColor: WHITE,
    currentTurn: BLACK,
    isRunning: false,
};

// =========================
// Training Mode
// =========================

// 学習開始
btnStart.addEventListener("click", () => {
    // パラメータを反映
    trainingState.totalEpochs = parseInt(document.getElementById("epoch-input").value);
    trainingState.epsilon = parseFloat(document.getElementById("epsilon-input").value);
    trainingState.gamma = parseFloat(document.getElementById("gamma-input").value);
    trainingState.snapshotInterval = parseInt(document.getElementById("snapshot-input").value);
    trainingState.epoch = 0;
    trainingState.results = [];
    trainingState.isPaused = false;

    progTotal.textContent = trainingState.totalEpochs;

    btnStart.disabled = true;
    btnPause.disabled = false;

    trainLoop(onEpochEnd);
});

// 一時停止 / 再開
btnPause.addEventListener("click", () => {
    trainingState.isPaused = !trainingState.isPaused;
    btnPause.textContent = trainingState.isPaused ? "▶ 再開" : "⏸ 一時停止";
});

// リセット
btnReset.addEventListener("click", () => {
    trainingState.isRunning = false;
    trainingState.isPaused = false;
    trainingState.epoch = 0;
    trainingState.results = [];
    trainingState.epsilon = parseFloat(document.getElementById("epsilon-input").value);

    btnStart.disabled = false;
    btnPause.disabled = true;
    btnPause.textContent = "⏸ 一時停止"

    progBar.style.width = "0%";
    progEpoch.textContent = "0";
    progPct.textContent = "0%";
    statMain.textContent = "—";
    statOpp.textContent = "—";
    statDraw.textContent = "—";
    boardStatus.textContent = "ready...";

    drawBoard(boardCanvas, createBoard());
});

// エポック終了ごとにUIを更新
function onEpochEnd(state, finalBoard) {
    const pct = Math.round(state.epoch / state.totalEpochs * 100);
    progBar.style.width = pct + "%";
    progEpoch.textContent = state.epoch;
    progPct.textContent = pct +"%";

    // 直近50ゲームの勝率を計算
    const recent = state.results.slice(-50);
    const n = recent.length;

    // メインモデルが勝った割合で集計
    const mainWin = recent.filter(r => r.winner === r.mainColor).length;
    const oppWin = recent.filter(r => r.winner !== r.mainColor && r.winner !== EMPTY).length;
    const draw = recent.filter(r => r.winner === EMPTY).length;

    statMain.textContent = (mainWin / n * 100).toFixed(0) + "%";
    statOpp.textContent = (oppWin / n * 100).toFixed(0) + "%";
    statDraw.textContent = (draw / n * 100).toFixed(0) + "%";

    // snapshotタイミングを表示
    const nextSnap = state.snapshotInterval - (state.epoch % state.snapshotInterval);
    boardStatus.textContent = `Epoch ${state.epoch} / ε=${state.epsilon.toFixed(3)} / 次のsnapshot: ${nextSnap}後`;

    // 盤面を更新
    drawBoard(boardCanvas, finalBoard);

    // 学習完了
    if (!state.isRunning) {
        btnStart.disabled = false;
        btnPause.disabled = true;
        boardStatus.textContent = "学習完了";
    }

    drawChart(state.results);

    // 10 epochごとに View NN を更新
    if (state.epoch % 10 === 0) {
        const w = extractWeights(model);
        const acts = extractActivations(model, finalBoard, BLACK);
        resizeAndDraw(w, acts);
    }
}

// チャートの描画
function drawChart(results) {
    const ctx = chartCanvas.getContext("2d");
    const w = chartCanvas.offsetWidth;
    const h = chartCanvas.offsetHeight;
    chartCanvas.width = w;
    chartCanvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // 背景
    ctx.fillStyle = "#0e1520";
    ctx.fillRect(0, 0, w, h);

    if (results.length < 2) return;

    // 10ゲームごとの勝率を集計
    const buckets = [];
    const step = 10;
    for (let i = step; i <= results.length; i += step) {
        const slice = results.slice(i - step, i);
        const n = slice.length;
        buckets.push({
            epoch: i,
            mainWin: slice.filter(r => r.winner === r.mainColor).length / n,
            oppWin: slice.filter(r => r.winner !== r.mainColor && r.winner !== EMPTY).length / n,
            draw: slice.filter(r => r.winner === EMPTY).length / n,
        });
    }

    if (buckets.length < 2) return;

    const padL = 40, padR = 16, padT = 16, padB = 30;
    const gw = w - padL - padR;
    const gh = h - padT - padB;

    // grid
    ctx.strokeStyle = "#1e3048";
    ctx.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1.0].forEach(v => {
        const y = padT + gh * (1 - v);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + gw, y);
        ctx.stroke();

        ctx.fillStyle = "#7a9aaa";
        ctx.font = "10px sans-serif";
        ctx.fillText((v * 100).toFixed(0) + "%", 2, y + 4);
    });

    // 折れ線の表示
    const lines = [
        { key: "mainWin", color: "#5bb8c9", label: "Main Model" },
        { key: "oppWin", color: "#e8ede6", label: "Snapshot Model" },
        { key: "draw", color: "#c8a060", label: "Draw" },
    ];

    lines.forEach(({ key, color }) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        buckets.forEach((b, i) => {
            const x = padL + (i / (buckets.length - 1)) * gw;
            const y = padT + gh * (1 - b[key]);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    });

    // 凡例
    lines.forEach(({ label, color }, i) => {
        ctx.fillStyle = color;
        ctx.font = "11px sans-serif";
        ctx.fillText(label, padL + i * 90, h - 6);
    });
}


// =========================
// Battle Mode
// =========================

// ログに追記
function addLog(msg) {
    const p = document.createElement("p");
    p.textContent = msg;
    battleLog.prepend(p);
}

// スコア表示を更新
function updateBattleScore(board) {
    const { black, white } = getScore(board);
    scoreBlack.textContent = black;
    scoreWhite.textContent = white;
}

// 打てる手をハイライト
function drawBattleBoard(board, canMoves) {
    drawBoard(battleCanvas, board);
    const ctx = battleCanvas.getContext("2d");
    const cell = battleCanvas.width / SIZE;

    canMoves.forEach(([r, c]) => {
        const x = c * cell + cell / 2;
        const y = r * cell + cell / 2;
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(91,184,201,0.5)";
        ctx.fill();
    });
}

// AIのターンを処理
async function doAiTurn() {
    await new Promise(r => setTimeout(r, 400));

    const place = getAvailableMoves(battleState.board, battleState.aiColor);
    if (place.length === 0) {
        addLog("AIはパスしました");
        battleState.currentTurn = battleState.playerColor;
        doPlayerTurn();
        return;
    }

    const move = selectAction(model, battleState.board, battleState.aiColor, 0.0);
    battleState.board = applyMove(battleState.board, move[0], move[1], battleState.aiColor);

    const colorLabel = battleState.aiColor === BLACK ? "⚫" : "⚪";
    addLog(`AI ${colorLabel} → (${move[0]}, ${move[1]})`);
    updateBattleScore(battleState.board);

    if (isGameOver(battleState.board)) {
        endBattle();
        return;
    }

    battleState.currentTurn = battleState.playerColor;
    doPlayerTurn();
}

// プレイヤーのターンを準備
function doPlayerTurn() {
    const place = getAvailableMoves(battleState.board, battleState.playerColor);

    if (place.length === 0) {
        addLog("あなたはパスします");
        battleState.currentTurn = battleState.aiColor;
        doAiTurn();
        return;
    }

    drawBattleBoard(battleState.board, place);
    const colorLabel = battleState.playerColor === BLACK ? "⚫" : "⚪";
    battleStatus.textContent = `あなたのターン ${colorLabel} — マスをクリック`;
}

// 対戦終了
function endBattle() {
    const winner = getWinner(battleState.board);
    drawBattleBoard(battleState.board, []);
    updateBattleScore(battleState.board);

    if (winner === battleState.playerColor) {
        battleStatus.textContent = "あなたの勝ち";
        addLog("あなたの勝ち");
    } else if (winner === battleState.aiColor) {
        battleStatus.textContent = "AIの勝ち";
        addLog("AIの勝ち");
    } else {
        battleStatus.textContent = "引き分け";
        addLog("引き分け");
    }

    battleState.isRunning = false;
}

// クリックで手を打つ
battleCanvas.addEventListener("click", (e) => {
    if (!battleState.isRunning) return;
    if (battleState.currentTurn !== battleState.playerColor) return;

    const rect = battleCanvas.getBoundingClientRect();
    const cell = battleCanvas.width / SIZE;
    const c = Math.floor((e.clientX - rect.left) / cell);
    const r = Math.floor((e.clientY - rect.top) / cell);

    if (!canPlace(battleState.board, r, c, battleState.playerColor)) return;

    battleState.board = applyMove(battleState.board, r, c, battleState.playerColor);
    const colorLabel = battleState.playerColor === BLACK ? "⚫" : "⚪";
    addLog(`あなた ${colorLabel} → (${r}, ${c})`);
    updateBattleScore(battleState.board);

    if (isGameOver(battleState.board)) {
        endBattle();
        return;
    }

    battleState.currentTurn = battleState.aiColor;
    doAiTurn();
});

// 対戦開始
btnBattleStart.addEventListener("click", () => {
    const colorVal = document.querySelector('input[name="player-color"]:checked').value;
    battleState.playerColor = colorVal === "black" ? BLACK : WHITE;
    battleState.aiColor = colorVal === "black" ? WHITE : BLACK;
    battleState.board = createBoard();
    battleState.currentTurn = BLACK;
    battleState.isRunning = true;

    battleLog.innerHTML = "";
    updateBattleScore(battleState.board);
    addLog("-- 対戦開始 --");

    if(battleState.playerColor === BLACK) {
        doPlayerTurn();
    } else {
        battleState.textContent = "AIのターン...";
        doAiTurn();
    }
});

// 対戦リセット
btnBattleReset.addEventListener("click", () => {
    battleState.isRunning = false;
    drawBoard(battleCanvas, createBoard());
    battleStatus.textContent = "学習を完了してから対戦してください";
    scoreBlack.textContent = "2";
    scoreWhite.textContent = "2";
    battleLog.innerHTML = "";
});

// =========================
// View NN
// =========================
const btnStrength = document.getElementById("btn-strength");
const strengthStatus = document.getElementById("strength-status");
const strengthBar = document.getElementById("strength-bar");
const strengthProg = document.getElementById("strength-prog");
const strengthWin = document.getElementById("strength-win");
const strengthLose = document.getElementById("strength-lose");
const strengthDraw = document.getElementById("strength-draw");

btnStrength.addEventListener("click", async () => {
    btnStrength.disabled = true;
    strengthStatus.textContent = "測定中...";

    const GAMES = 100;
    let win = 0, lose = 0, draw = 0;

    for (let i = 0; i < GAMES; i++) {
        // ランダムAIとの対戦
        const mainColor = i % 2 === 0 ? BLACK : WHITE;
        let board = createBoard();
        let color = BLACK;

        while(!isGameOver(board)) {
            const place = getAvailableMoves(board, color);
            if (place.length === 0) {
                color = color === BLACK ? WHITE : BLACK;
                continue;
            }

            let move;
            if (color === mainColor) {
                // メインモデル
                move = selectAction(model, board, color, 0.0);
            } else {
                move = place[Math.floor(Math.random() * place.length)];
            }

            board = applyMove(board, move[0], move[1], color);
            color = color === BLACK ? WHITE : BLACK;
        }

        const winner = getWinner(board);
        if (winner === mainColor) win++;
        else if (winner === EMPTY) draw++;
        else lose++;

        // 10戦ごとにUI更新
        if ((i + 1) % 10 === 0) {
            const pct = Math.round((i + 1) / GAMES * 100);
            strengthBar.style.width = pct + "%";
            strengthProg.textContent = i + 1;
            strengthWin.textContent = win;
            strengthLose.textContent = lose;
            strengthDraw.textContent = draw;

            await new Promise(r => setTimeout(r, 0));
        }
    }

    const winRate = (win / GAMES * 100).toFixed(1);
    strengthStatus.textContent = `測定完了! ランダムAIに対する勝率: ${winRate}%`;
    btnStrength.disabled = false;
})