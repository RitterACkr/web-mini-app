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

function bindEvents() {
    document.getElementById('btn-run').addEventListener('click', startSim);
    document.getElementById('btn-stop').addEventListener('click', stopSim);
    document.getElementById('btn-reset').addEventListener('click', resetAll);
    document.getElementById('btn-add-process').addEventListener('click', handleAddProcess);

    document.getElementById('scheduler-select').addEventListener('change', e => {
        setSchedulerType(e.target.value);
        log(`Scheduler changed to ${e.target.value.toUpperCase()}`, 'info');
    });

    document.getElementById('quantum-input').addEventListener('change', e => {
        const q = parseInt(e.target.value);
        setQuantum(q);
        log(`Quantum set to ${q}`, 'info');
    });

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
    logs.forEach(l => log(l.text, l.type));

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
        log(`[T=${getClock()}] ${proc.name} added end enqueued.`, 'info');
    } else {
        log(`${proc.name} added (burst=${burst}, priority=${priority}, mem=${memSize}).`, 'info');
    }

    // フォームのリセット
    nameEl.value = '';
    burstEl.value = '8';
    priorityEl.value = '5';

    renderAll();
}


/* ----------------------
    描画
 ---------------------- */
function renderAll() {
    renderProcTable();
    renderGantt();
    renderMemoryMap();
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


/* ----------------------
    ログ出力
 ---------------------- */
function log(text, type = 'info') {
    const out = document.getElementById('log-output');
    const span = document.createElement('span');
    span.className = `log-line log-${type}`;
    span.textContent = text;
    out.appendChild(span);
    out.scrollTop = out.scrollHeight;
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
    const logPanel = document.getElementById('log-panel');

    if (dividerLog && logPanel) {
        dividerLog.addEventListener('mousedown', e => {
            e.preventDefault();
            dividerLog.classList.add('dragging');

            const onMove = e => {
                const windowHeight = window.innerHeight;
                let newHeight = windowHeight - e.clientY;
                newHeight = Math.max(40, Math.min(newHeight, 300));
                logPanel.style.height = newHeight + 'px';
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
}