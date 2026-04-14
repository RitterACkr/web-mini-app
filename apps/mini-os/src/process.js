// =============================================================
//  process.js - PCB定義・プロセス生成・状態遷移管理
//
//  PCB (Process Control Block) とは
//    OSがプロセスを管理するためのデータ構造
//    プロセスごとに1つ存在し，スケジューラやメモリ管理が参照する
//
//  プロセス状態遷移:
//    New → Ready → Running → Waiting → Terminated
//                    ↑__________↓ (I/O完了などで戻る)
// =============================================================

const ProcessState = Object.freeze({
    NEW:        'new',
    READY:      'ready',
    RUNNING:    'running',
    WAITING:    'waiting',
    TERMINATED: 'terminated',
});

// プロセス用のカラーパレット
const PROCESS_COLORS = [
    '#58a6ff', '#3fb950', '#d29922', '#f85149',
    '#bc8cff', '#39d353', '#ffa657', '#79c0ff',
];

let _nextPid = 1;
let _colorIndex = 0;

/* ====================================
    PCB Factory
==================================== */
function createProcess({ name, burst, priority = 5, memSize = 20 }) {
    return {
        pid:            _nextPid++,
        name:           name || `P${_nextPid - 1}`,
        state:          ProcessState.NEW,
        priority:       Math.min(10, Math.max(1, priority)), // 1(低) ~ 10(高)

        // バースト時間: このプロセスがCPUを必要とする合計クロック数
        burstTotal:     burst,
        burstRemain:    burst,  // 残り実行時間

        // 待ち時間・ターンアラウンド計測用
        arrivalTime:    0,      // Readyキューに入った時刻
        startTime:      null,   // 初めてRunningになった時刻
        finishTime:     null,   // terminatedになった時刻

        // メモリ
        memSize,                //  要求メモリ量
        memStart:       null,   // アロケーション後にセット

        // 表示用
        color:          PROCESS_COLORS[_colorIndex++ % PROCESS_COLORS.length],
    };
}

/* ====================================
    状態遷移
    - 不正な遷移はエラーを返す
==================================== */
const VALID_TRANSITIONS = {
    [ProcessState.NEW]:         [ProcessState.READY],
    [ProcessState.READY]:       [ProcessState.RUNNING],
    [ProcessState.RUNNING]:     [ProcessState.READY, ProcessState.WAITING, ProcessState.TERMINATED],
    [ProcessState.WAITING]:     [ProcessState.READY],
    [ProcessState.TERMINATED]:  [],
};

function transitionState(proc, nextState) {
    const allowed = VALID_TRANSITIONS[proc.state];
    if (!allowed.includes(nextState)) {
        return `[ERROR] Invalid transition: ${proc.name} ${proc.state} → ${nextState}`;
    }
    proc.state = nextState;
    return null;
}

/* ====================================
    プロセステーブル
    (全プロセスを保持する配列)
==================================== */
const processTable = [];

function addProcess(params) {
    const proc = createProcess(params);
    processTable.push(proc);
    return proc;
}

function removeProcess(pid) {
    const idx = processTable.findIndex(p => p.pid === pid);
    if (idx !== -1) processTable.splice(idx, 1);
}

function getProcess(pid) {
    return processTable.find(p => p.pid === pid) || null;
}

function resetProcesses() {
    processTable.length = 0;
    _nextPid = 1;
    _colorIndex = 0;
}

/* ====================================
    ユーティリティ
==================================== */

// ターンアラウンドタイム = 終了時刻 - 到着時刻
function turnAroundTime(proc) {
    if (proc.finishTime === null) return null;
    return proc.finishTime - proc.arrivalTime;
}

// 待ち時間 = ターンアラウンドタイム - バースト合計
function waitingTime(proc) {
    const tat = turnAroundTime(proc);
    if (tat === null) return null;
    return tat - proc.burstTotal;
}