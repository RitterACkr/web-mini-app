// =============================================================
// scheduler.js - スケジューラ (FCFS / Round Robin / Priority)
//
// - Readyキューの管理
// - 1クロックごとに次に実行するプロセスを決定
// - タイムスライスカウント
// =============================================================

const SchedulerType = Object.freeze({
    FCFS:       'fcfs',
    RR:         'rr',
    PRIORITY:   'priority',
});

// スケジューラ内部の状態
let _type           = SchedulerType.RR;
let _quantum        = 4;    // Round Robin のタイムスライス
let _quantumLeft    = 0;    // 現在のプロセスの残りスライス
let _readyQueue     = [];   // pid の配列
let _runningPid     = null; // 現在実行中のpid
let _clock          = 0;    // シミュレーション経過クロック数

// ガントチャート用の記録
// [{ pid, name, color, start, end }]
let _ganttLog       = [];
let _ganttCurrent   = null;


/* ----------------------
    初期化・設定
 ---------------------- */
function initScheduler({ type = SchedulerType.RR, quantum = 4 } = {}) {
    _type           = type;
    _quantum        = quantum;
    _quantumLeft    = 0;
    _readyQueue     = [];
    _runningPid     = null;
    _clock          = 0;
    _ganttLog       = [];
    _ganttCurrent   = null;
}

function setSchedulerType(type) { _type = type; }
function setQuantum(q) { _quantum = Math.max(1, q); }
function getClock() { return _clock; }
function getGanttLog() { return [..._ganttLog]; }
function getReadyQueue() { return [..._readyQueue]; }
function getRunningPid() { return _runningPid; }


/* ----------------------
    Readyキューへの追加
 ---------------------- */
function enqueue(proc) {
    proc.arrivalTime = _clock;
    if (!_readyQueue.includes(proc.pid)) {
        _readyQueue.push(proc.pid);
    }
}

/* --------------------------------------
    次の実行するプロセスをキューから選択

    FCFS     : 先頭をそのまま取り出す
    RR       : 先頭を取り出す (タイムスライスで制御)
    Priority : 最高優先度のプロセスを取り出す
 ------------------------------------- */
function _dequeue(procTable) {
    if (_readyQueue.length === 0) return null;

    if (_type === SchedulerType.PRIORITY) {
        // 優先度最大のプロセスを選択
        let bestIdx = 0;
        let bestPri = -Infinity;
        for (let i = 0; i < _readyQueue.length; i++) {
            const proc = procTable.find(p => p.pid === _readyQueue[i]);
            if (proc && proc.priority > bestPri) {
                bestPri = proc.priority;
                bestIdx = i;
            }
        }
        const [pid] = _readyQueue.splice(bestIdx, 1);
        return pid;
    }

    // FCFS, RR : 先頭
    return _readyQueue.shift();
}


/* -------------------------------------------------------
    1クロック進める

    return: { log: string[], finished: pid[] }
        log      : ログパネルに流すメッセージ
        finished : このクロックで終了したプロセスのpid配列
 ------------------------------------------------------ */
function tick(procTable) {
    const logs = [];
    const finished = [];

    _clock++;

    // 1. 現在実行中のプロセスを取得
    let running = procTable.find(p => p.pid === _runningPid) || null;

    // 2. 実行中プロセスを1クロック消費
    if (running) {
        running.burstRemain--;
        _quantumLeft--;

        // 2.1. バースト完了 -> Terminated
        if (running.burstRemain <= 0) {
            running.finishTime = _clock;
            const err = transitionState(running, ProcessState.TERMINATED);
            if (err) logs.push({ type: 'error', text: err });
            else logs.push({ type: 'ok', text: `[T=${_clock}] ${running.name} finished (TAT=${running.finishTime - running.arrivalTime})` });

            free(running.pid);          // メモリ解放
            finished.push(running.pid);
            _ganttFlush(_clock);
            _runningPid = null;
            running = null;
        }

        // 2.2. タイムスライス切れ (RR) -> Readyに戻す
        else if (_type === SchedulerType.RR && _quantumLeft <= 0) {
            const err = transitionState(running, ProcessState.READY);
            if (err) logs.push({ type: 'error', text: err });
            else logs.push({ type: 'warn', text: `[T=${_clock}] ${running.name} preempted (remain=${running.burstRemain})` });

            _ganttFlush(_clock);
            enqueue(running);       // キュー末尾に戻す
            _runningPid = null;
            running = null;
        }
    }

    // 3. 次のプロセスをキューから選択
    if (!running && _readyQueue.length > 0) {
        const nextPid = _dequeue(procTable);
        const next = procTable.find(p => p.pid === nextPid);

        if (next) {
            if (next.startTime === null) next.startTime = _clock;
            const err = transitionState(next, ProcessState.RUNNING);
            if (err) {
                logs.push({ type: 'error', text: err });
            } else {
                _runningPid = next.pid;
                _quantumLeft = _quantum;
                _ganttStart(next, _clock);
                logs.push({ type: 'info', text: `[T=${_clock}] ${next.name} started running` });
            }
        }
    }

    // 4. アイドル状態
    if (!_runningPid && _readyQueue.length === 0) {
        _ganttIdle(_clock);
    }

    return { logs, finished };
}


/* --------------------------
    ガントチャート記録 Helper
 ------------------------- */
function _ganttStart(proc, clock) {
    _ganttFlush(clock);
    _ganttCurrent = { pid: proc.pid, name: proc.name, color: proc.color, start: clock, end: null, idle: false };
}

function _ganttIdle(clock) {
    if (_ganttCurrent && _ganttCurrent.idle) return;
    _ganttFlush(clock);
    _ganttCurrent = { pid: null, name: 'IDLE', color: null, start: clock, end: null, idle: true };
}

function _ganttFlush(clock) {
    if (_ganttCurrent) {
        _ganttCurrent.end = clock;
        if (_ganttCurrent.end > _ganttCurrent.start) {
            _ganttLog.push({ ..._ganttCurrent });
        }
        _ganttCurrent = null;
    }
}