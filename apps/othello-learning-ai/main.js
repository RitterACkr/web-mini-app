// モデルの初期化
const model = createModel();

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
    })
});

// UI要素
const btnStart = document.getElementById("btn-start");
const btnPause = document.getElementById("btn-pause");
const btnReset = document.getElementById("btn-reset");
const progBar = document.getElementById("progress-bar");
const progEpoch = document.getElementById("prog-epoch");
const progTotal = document.getElementById("prog-total");
const progPct = document.getElementById("prog-pct");
const statBlack = document.getElementById("stat-black");
const statWhite = document.getElementById("stat-white");
const statDraw = document.getElementById("stat-draw");
const boardStatus = document.getElementById("board-status");
const boardCanvas = document.getElementById("board-canvas");

// 学習開始
btnStart.addEventListener("click", () => {
    // パラメータを反映
    trainingState.totalEpochs = parseInt(document.getElementById("epoch-input").value);
    trainingState.epsilon = parseFloat(document.getElementById("epsilon-input").value);
    trainingState.gamma = parseFloat(document.getElementById("gamma-input").value);
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
    statBlack.textContent = "—";
    statWhite.textContent = "—";
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
    const bWin = recent.filter(r => r.winner === BLACK).length;
    const wWin = recent.filter(r => r.winner === WHITE).length;
    const draw = recent.filter(r => r.winner === EMPTY).length;
    const n = recent.length;

    statBlack.textContent = (bWin / n * 100).toFixed(0) + "%";
    statWhite.textContent = (wWin / n * 100).toFixed(0) + "%";
    statDraw.textContent = (draw / n * 100).toFixed(0) + "%";

    boardStatus.textContent = `Epoch ${state.epoch} / ε=${state.epsilon.toFixed(3)}`;

    // 盤面を更新
    drawBoard(boardCanvas, finalBoard);

    // 学習完了
    if (!state.isRunning) {
        btnStart.disabled = false;
        btnPause.disabled = true;
        boardStatus.textContent = "学習完了";
    }
}