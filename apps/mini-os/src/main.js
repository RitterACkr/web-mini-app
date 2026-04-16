// =============================================================
// main.js - シミュレーションのループ・UI制御用
//
// - UIイベントのハンドリング
// - setInterval を用いたループ制御
// - 各モジュールの統合
// - DOM 更新 (processTable, ganttChart, memoryMap, log)
// =============================================================

const TICK_INTERVAL_MS = 600;   // 1クロック当たりの実時間 (ms)
const DEFAULT_MEM_SIZE = 20;    // プロセスのデフォルトメモリ使用量

let _intervalId = null;
let _isRunning = false;


/* ----------------------
    初期化・設定
 ---------------------- */
window.addEventListener('DOMContentLoaded', () => {
    resetAll();
    bindEvents();
    log('mini-os ready. Add processes and press ▶ Run.', 'info');
});

// イベント登録の管理
function bindEvents() {
    document.getElementById('btn-run').addEventListener('click', startSim);
    document.getElementById('btn-stop').addEventListener('click', stopSim);
    document.getElementById('btn-reset').addEventListener('click', resetAll);
    document.getElementById('btn-add-process').addEventListener('click', handleAddProcess);
    document.getElementById('btn-io-wait').addEventListener('click', handleForceWait);

    document.getElementById('scheduler-select').addEventListener('change', e => {
        setSchedulerType(e.target.value);
        log(`Scheduler changed to ${e.target.value.toUpperCase()}`, 'info');
    });

    document.getElementById('quantum-input').addEventListener('change', e => {
        const q = parseInt(e.target.value);
        setQuantum(q);
        log(`Quantum set to ${q}`, 'info');
    });

    document.getElementById('btn-compact').addEventListener('click', handleCompact);

    initResizer();
}


/* ----------------------
    シミュレーション制御
 ---------------------- */
function startSim() {
    if (_isRunning) return;

    const hasReady = processTable.some(p => p.state === ProcessState.READY || p.state === ProcessState.NEW);
    if (!hasReady) {
        log('No prcesses to run. Add at least one process.', 'warn');
        return;
    }

    // NEW -> READY に一括で遷移
    processTable.forEach(p => {
        if (p.state === ProcessState.NEW) {
            transitionState(p, ProcessState.READY);
            enqueue(p);
        }
    });

    _isRunning = true;
    _intervalId = setInterval(simLoop, TICK_INTERVAL_MS);
    log('▶ Simulation started.', 'ok');
    renderAll();
}

function stopSim() {
    if (!_isRunning) return;
    clearInterval(_intervalId);
    _isRunning = false;
    log('■ Simulation stopped.', 'warn');
}

function resetAll() {
    stopSim();
    resetProcesses();
    resetMemory();
    initScheduler({
        type: document.getElementById('scheduler-select')?.value || 'rr',
        quantum: parseInt(document.getElementById('quantum-input')?.value || 4)
    });
    clearLog();
    renderAll();
}


/* ----------------------
    シミュレーションループ
 ---------------------- */
function simLoop() {
    const { logs, finished } = tick(processTable);

    // ログ出力
    logs.forEach(l => logWithClock(l.text, l.type));

    // 全プロセスが終了したか判定
    const allDone = processTable.length > 0 && processTable.every(p => p.state === ProcessState.TERMINATED);

    if (allDone) {
        stopSim();
        log('✔ All processes finished.', 'ok');
        renderStats();
    }

    renderAll();
}

/* ----------------------
    プロセスの追加
 ---------------------- */
function handleAddProcess() {
    const nameEl = document.getElementById('proc-name');
    const burstEl = document.getElementById('proc-burst');
    const priorityEl = document.getElementById('proc-priority');

    const name = nameEl.value.trim() || `P${processTable.length + 1}`;
    const burst = parseInt(burstEl.value) || 8;
    const priority = parseInt(priorityEl.value) || 5;
    const memSize = DEFAULT_MEM_SIZE;

    // メモリの確保
    const mem = allocate(-1, memSize);
    if (!mem) {
        log(`Cannot add ${name}: not enough memory (need ${memSize})`, 'error');
        return;
    }
    free(-1);

    // プロセスの生成
    const proc = addProcess({ name, burst, priority, memSize });

    const allocated = allocate(proc.pid, memSize);
    if (allocated) {
        proc.memStart = allocated.start;
    }

    // 実行中なら即座に Ready キューへ
    if (_isRunning) {
        transitionState(proc, ProcessState.READY);
        enqueue(proc);
        logWithClock(`${proc.name} added end enqueued.`, 'info');
    } else {
        logWithClock(`${proc.name} added (burst=${burst}, priority=${priority}, mem=${memSize}).`, 'info');
    }

    // フォームのリセット
    nameEl.value = '';
    burstEl.value = '8';
    priorityEl.value = '5';

    renderAll();
}


/* ----------------------
    Compact
 ---------------------- */
 function handleDeleteProcess(pid) {
    const proc = getProcess(pid);
    if (!proc) return;
    if (proc.state !== ProcessState.NEW && proc.state !== ProcessState.READY) return;

    free(pid);
    removeProcess(pid);
    log(`${proc.name} removed.`, `warn`);
    renderAll();
 }


/* ----------------------
    描画
 ---------------------- */
function renderAll() {
    renderProcTable();
    renderGantt();
    renderMemoryMap();
    renderStatsPanel();
}

// プロセステーブル
function renderProcTable() {
    const tbody = document.getElementById('process-tbody');
    tbody.innerHTML = '';

    processTable.forEach(p => {
        const tr = document.createElement('tr');

        if (p.state === ProcessState.RUNNING) {
            tr.style.background = '#1a3a2a';
        }

        tr.innerHTML = `
            <td>${p.pid}</td>
            <td style="color:${p.color}; font-weight:bold">${p.name}</td>
            <td><span class="state-badge state-${p.state}">${p.state}</span></td>
            <td>${p.priority}</td>
            <td>${p.burstRemain}/${p.burstTotal}</td>
            <td>${p.state === ProcessState.NEW || p.state === ProcessState.READY
                ? `<button class="btn btn-delete" onclick="handleDeleteProcess(${p.pid})">✕</button>`
                : ''
            }</td>
        `;
        tbody.appendChild(tr);
    });
}

// ガントチャート
function renderGantt() {
    const chart = document.getElementById('gantt-chart');
    const legend = document.getElementById('gantt-legend');
    const log = getGanttLog();

    chart.innerHTML = '';
    legend.innerHTML = '';

    const seen = new Set();

    log.forEach(block => {
        const duration = block.end - block.start;
        const div = document.createElement('div');
        div.className = block.idle ? 'gantt-block gantt-idle' : 'gantt-block'

        if (!block.idle) {
            div.style.background = block.color;
            div.style.minWidth = `${duration * 18}px`;
            div.title = `${block.name} [${block.start}-${block.end}]`;
            div.textContent = duration >= 2 ? block.name : '';
        } else {
            div.style.minWidth = `${duration * 18}px`;
            div.textContent = duration >= 2 ? 'idle' : '';
        }

        chart.appendChild(div);

        // 凡例
        if (!block.idle && !seen.has(block.pid)) {
            seen.add(block.pid);
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-dot" style="background:${block.color}"></div>
                ${block.name}
            `;
            legend.appendChild(item);
        }
    });
}

// メモリマップ
function renderMemoryMap() {
    const map = document.getElementById('memory-map');
    const memInfo = document.getElementById('mem-info');
    const blocks = getBlocks();

    map.innerHTML = '';

    blocks.forEach(block => {
        const div = document.createElement('div');
        const pct = block.size;
        div.className = block.pid === null ? 'mem-block mem-free' : 'mem-block';
        div.style.width = `${pct}%`;

        if (block.pid !== null) {
            const proc = getProcess(block.pid);
            if (proc) {
                div.style.background = proc.color;
                div.style.color = '#0d1117';
                div.title = `${proc.name}: ${block.size}%`;
                div.textContent = block.size >= 8 ? proc.name : '';
            }
        } else {
            div.title = `Free: ${block.size}%`;
            div.textContent = block.size >= 8 ? `Free(${block.size}%)` : '';
        }

        map.appendChild(div);
    });

    memInfo.textContent = `used: ${getUsedSize()} / free: ${getFreeSize()}`;
}

// 統計
function renderStats() {
    const done = processTable.filter(p => p.state === ProcessState.TERMINATED);
    if (done.length === 0) return;

    const avgTAT = (done.reduce((s, p) => s + turnAroundTime(p), 0) / done.length).toFixed(1);
    const avgWT = (done.reduce((s, p) => s + waitingTime(p), 0) / done.length).toFixed(1);

    log(`――― Stats ――― Avg TAT: ${avgTAT}  |  Avg Wait: ${avgWT}`, 'info');
}

// 統計パネル
function renderStatsPanel() {
    const chart = document.getElementById('stats-chart');
    chart.innerHTML = '';

    const procs = processTable.filter(p => p.state !== ProcessState.NEW);

    if (procs.length === 0) {
        chart.innerHTML = '<div style="color: var(--text-dim); font-size: 11px;">No data yet.</div>';
        return;
    }

    const maxTAT = processTable.reduce((s, p) => s + p.burstTotal, 0) || 1;

    procs.forEach(p => {
        const isDone = p.state === ProcessState.TERMINATED;

        const tatVal = isDone ? turnAroundTime(p) : (getClock() - p.arrivalTime);

        const executedClocks = p.burstTotal - p.burstRemain;
        const wtVal = isDone ? waitingTime(p) : Math.max(0, tatVal - executedClocks);

        const tatPct = (tatVal / maxTAT * 100).toFixed(1);
        const wtPct = (wtVal / maxTAT * 100).toFixed(1);


        const row = document.createElement('div');
        row.className = 'stats-row';
        row.innerHTML = `
            <div class="stats-proc-name" style="color: ${p.color}">
                ${p.name} ${isDone ? '✔' : '...'}
            </div>
            <div class="stats-bar-wrap">
                <span class="stats-bar-label">TAT</span>
                <div class="stats-bar-bg">
                    <div class="stats-bar-fill" style="width: ${tatPct}%; background: ${p.color}; opacity: 0.9">
                    </div>
                </div>
                <span class="stats-bar-value">${tatVal}</span>
            </div>
            <div class="stats-bar-wrap">
                <span class="stats-bar-label">Wait</span>
                <div class="stats-bar-bg">
                    <div class="stats-bar-fill" style="width: ${wtPct}%; background: ${p.color}; opacity: 0.5">
                    </div>
                </div>
                <span class="stats-bar-value">${wtVal}</span>
            </div>
        `;
        chart.appendChild(row);
    });
}


/* ----------------------
    ログ出力
 ---------------------- */
function log(text, type = 'info') {
    const out = document.getElementById('log-output');
    const span = document.createElement('span');
    span.className = `log-line log-${type}`;
    span.textContent = text;
    out.appendChild(span);
    document.getElementById('log-panel').scrollTop = document.getElementById('log-panel').scrollHeight;
}

function logWithClock(text, type = 'info') {
    const ts = String(getClock()).padStart(3, '0');
    log(`[T=${ts}] ${text}`, type);
}

function clearLog() {
    document.getElementById('log-output').innerHTML = '';
}


/* ----------------------
    ドラッグリサイズ
 ---------------------- */
function initResizer() {
    // 左右
    const dividerLR = document.getElementById('divider-lr');
    const panelProcess = document.getElementById('panel-process');

    dividerLR.addEventListener('mousedown', e => {
        e.preventDefault();
        dividerLR.classList.add('dragging');

        const onMove = e => {
            const workspace = document.querySelector('.workspace');
            const rect = workspace.getBoundingClientRect();
            let newWidth = e.clientX - rect.left;
            newWidth = Math.max(180, Math.min(newWidth, workspace.clientWidth * 0.5));
            panelProcess.style.width = newWidth + 'px';
        };

        const onUp = () => {
            dividerLR.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // 上下
    const dividerUD = document.getElementById('divider-ud');
    const panelTimeline = document.getElementById('panel-timeline');

    dividerUD.addEventListener('mousedown', e => {
        e.preventDefault();
        dividerUD.classList.add('dragging');

        const onMove = e => {
            const rightPane = document.getElementById('right-pane');
            const rect = rightPane.getBoundingClientRect();
            let newHeight = e.clientY - rect.top;
            newHeight = Math.max(80, Math.min(newHeight, rightPane.clientHeight - 60));
            panelTimeline.style.height = newHeight + 'px';
        };

        const onUp = () => {
            dividerUD.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // ログパネル上下
    const dividerLog = document.getElementById('divider-log');
    const logFooter = document.getElementById('log-footer');

    if (dividerLog && logFooter) {
        dividerLog.addEventListener('mousedown', e => {
            e.preventDefault();
            dividerLog.classList.add('dragging');

            const onMove = e => {
                const windowHeight = window.innerHeight;
                let newHeight = windowHeight - e.clientY;
                newHeight = Math.max(40, Math.min(newHeight, 300));
                logFooter.style.height = newHeight + 'px';
            };

            const onUp = () => {
                dividerLog.classList.remove('dragging');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    // 統計パネル左右
    const dividerStats = document.getElementById('divider-stats');
    const statsPanel = document.getElementById('stats-panel');

    if (dividerStats && statsPanel) {
        dividerStats.addEventListener('mousedown', e => {
            e.preventDefault();
            dividerStats.classList.add('dragging');

            const onMove = e => {
                const logFooter = document.getElementById('log-footer');
                const rect = logFooter.getBoundingClientRect();
                let newWidth = rect.right - e.clientX;
                newWidth = Math.max(120, Math.min(newWidth, logFooter.clientWidth * 0.6));
                statsPanel.style.width = newWidth + 'px';
            };

            const onUp = () => {
                dividerStats.classList.remove('dragging');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }
}


/* ----------------------
    Compact
 ---------------------- */
function handleCompact() {
    compact();
    log('Memory compacted.', 'info');
    renderMemoryMap();
}


/* ----------------------
    I/O waiting
 ---------------------- */
function handleForceWait() {
    if (!_isRunning) {
        logWithClock('Simulation is not running.', 'warn');
        return;
    }

    const result = forceWait(processTable);
    if (!result) {
        logWithClock('No running process to send to I/O wait.', 'warn');
        return;
    }
    if (typeof result === 'string') {
        logWithClock(result, 'error');
        return;
    }

    logWithClock(`${result.proc.name} → Waiting (I/O: ${result.waitClocks} clocks)`, 'warn');
}