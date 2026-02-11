// ==================
// Opcodes
// ==================
const OP = {
    LDA_IMM:    0x01,   // A = imm8
    LDB_IMM:    0x02,   // B = imm8
    ADD:        0x03,   // A = (A+B)&0xFF, Z set
    PRINTA:     0x04,   // print A
    DEC_A:      0x05,   // A = (A-1)&0xFF, Z set
    CMP_A_IMM:  0x06,   // Z = (A-imm==0) ? 1 : 0, Aは変更なし
    SUB_A_IMM:  0x07,   // A = (A-imm)&0xFF, Z set

    JMP:        0x10,   // PC = addr
    JZ:         0x11,   // if Z==1: PC = addr
    JNZ:        0x12,   // if Z==0: PC = addr

    LDA_MEM:    0x20,   // A = mem[addr], Z set
    STA_MEM:    0x21,   // mem[addr] = A

    PUSH_A:     0x30,   // mem[SP] = A, SP = SP-1
    POP_A:      0x31,   // SP = SP+1, A = mem[SP]

    HALT:       0xFF
};

const OP_NAME = Object.fromEntries(Object.entries(OP).map(([k, v]) => [v, k]));

function hex2(n) {
    return n.toString(16).toUpperCase().padStart(2, "0");
}

// ==================
// Assembler
// ==================
const INSTR_SIZE = {
    LDA_IMM:    2,
    LDB_IMM:    2,
    ADD:        1,
    PRINTA:     1,
    DEC_A:      1,
    CMP_A_IMM:  2,
    SUB_A_IMM:  2,
    JMP:        2,
    JZ:         2,
    JNZ:        2,
    LDA_MEM:    2,
    STA_MEM:    2,
    PUSH_A:     1,
    POP_A:      1,
    HALT:       1
};

function parseNumber(token) {
    if (/^0x[0-9a-f]+$/i.test(token)) return parseInt(token, 16);
    if (/^-?\d+$/.test(token)) return parseInt(token, 10);
    return null;
}

function tokenize(line) {
    // コメントの除去
    const noComment = line.split(";")[0].trim();
    if (!noComment) return [];

    // , 区切りも空白として扱う
    return noComment.replace(/,/g, " ").trim().split(/\s+/);
}

function assemble(asm) {
    const lines = asm.split("\n");

    // 1. lebel -> addr
    const labels = new Map();
    let pc = 0;

    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
        const raw = lines[lineNo].trim();
        if (!raw || raw.startsWith(";")) continue;
        
        // label:
        if (/^[A-Za-z_]\w*:\s*$/.test(raw)) {
            const label = raw.slice(0, -1);
            if (labels.has(label)) {
                throw new Error(`Duplicate label "${label}" at line ${lineNo + 1}`)
            }
            labels.set(label, pc & 0xFF);
            continue;
        }

        const t = tokenize(raw);
        if (t.length === 0) continue;

        const op = t[0].toUpperCase();
        const size = INSTR_SIZE[op];
        if (!size) throw new Error(`Unknown instruction: "${op}" at line ${lineNo + 1}`);

        pc += size;
    }

    // 2. emit bytes
    const out = [];
    pc = 0;

    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
        const raw = lines[lineNo].trim();
        if (!raw || raw.startsWith(";")) continue;

        // label:
        if (/^[A-Za-z_]\w*:\s*$/.test(raw)) continue;

        const t = tokenize(raw);
        if (t.length === 0) continue;

        const opName =t[0].toUpperCase();
        const opcode = OP[opName];
        if (opcode === undefined) throw new Error(`Unknown opcode: "${opName}" at line ${lineNo + 1}`);

        out.push(opcode);
        pc++;

        const size = INSTR_SIZE[opName];

        if (size === 2) {
            if (t.length < 2) throw new Error(`Missing operand for "${opName}" at line ${lineNo + 1}`);

            const operandToken = t[1];
            let val = parseNumber(operandToken);

            if (val === null) {
                if (!labels.has(operandToken)) {
                    throw new Error(`Unknown label: "${operandToken}" at line ${lineNo + 1}`);
                }
                val = labels.get(operandToken);
            }

            out.push(val & 0xFF);
            pc++;
        }
    }

    return new Uint8Array(out);
}


// ==================
// CPU
// ==================
class CPU {
    constructor(memorySize = 256) {
        this.mem = new Uint8Array(memorySize);
        this.reset();
    }

    reset() {
        this.mem.fill(0);

        // registers
        this.pc = 0;
        this.a = 0;
        this.b = 0;
        this.z = 0;
        this.sp = 0xFF;

        // state
        this.halted = false;
        this.output = [];

        // latest write
        this.lastWrite = null;

        // trace log
        this.trace = [];
    }

    load(program, startAddr = 0x00) {
        this.reset();
        for (let i = 0; i < program.length; i++) {
            this.mem[(startAddr + i) & 0xFF] = program[i] & 0xFF;
        }
        this.pc = startAddr & 0xFF;
    }

    fetch() { 
        // PCが範囲外ならHALT扱い
        const v = this.mem[this.pc];
        this.pc = (this.pc + 1) & 0xFF;
        return v ?? OP.HALT;
    }

    push8(v) {
        this.mem[this.sp] = v & 0xFF;
        this.sp = (this.sp - 1) & 0xFF;
    }

    pop8() {
        this.sp = (this.sp + 1) & 0xFF;
        return this.mem[this.sp] & 0xFF;
    }

    step() {
        if (this.halted) return;

        // --  trace: before --
        const pc0 = this.pc & 0xFF;
        const a0 = this.a & 0xFF;
        const b0 = this.b & 0xFF;
        const z0 = this.z & 0xFF;
        const sp0 = this.sp & 0xFF;
        let operand = null;

        const op = this.fetch();

        switch(op) {
            case OP.LDA_IMM: {
                const imm = this.fetch();
                operand = imm & 0xFF;

                this.a = imm & 0xFF;
                this.z = (this.a === 0) ? 1 : 0;
                break;
            }
            case OP.LDB_IMM: {
                const imm = this.fetch();
                operand = imm & 0xFF;

                this.b = imm & 0xFF;
                this.z = (this.b === 0) ? 1 : 0;
                break;
            }
            case OP.ADD: {
                this.a = (this.a  + this.b) & 0xFF;
                this.z = (this.a === 0) ? 1 : 0;
                break;
            }
            case OP.PRINTA: {
                this.output.push(String(this.a));
                break;
            }
            case OP.DEC_A: {
                this.a = (this.a - 1) & 0xFF;
                this.z = (this.a === 0) ? 1 : 0;
                break;
            }
            case OP.CMP_A_IMM: {
                const imm = this.fetch();
                operand = imm & 0xFF;

                const r = ((this.a & 0xFF) - (imm & 0xFF)) & 0xFF;
                this.z = (r === 0) ? 1 : 0;
                break;
            }
            case OP.SUB_A_IMM: {
                const imm = this.fetch();
                operand = imm & 0xFF;

                this.a = ((this.a & 0xFF) - (imm & 0xFF)) & 0xFF;
                this.z = (this.a === 0) ? 1 : 0;
                break;
            }
            case OP.JMP: {
                const addr = this.fetch();
                operand = addr & 0xFF;

                this.pc = addr & 0xFF;
                break;
            }
            case OP.JZ: {
                const addr = this.fetch();
                operand = addr & 0xFF;

                if (this.z === 1) {
                    this.pc = addr & 0xFF;
                }
                break;
            }
            case OP.JNZ: {
                const addr = this.fetch();
                operand = addr & 0xFF;

                if (this.z === 0) {
                    this.pc = addr & 0xFF;
                }
                break;
            }
            case OP.LDA_MEM: {
                const addr = this.fetch();
                operand = addr & 0xFF;

                this.a = this.mem[addr & 0xFF];
                this.z = (this.a === 0) ? 1 : 0;
                break;
            }
            case OP.STA_MEM: {
                const addr = this.fetch();
                operand = addr & 0xFF;

                const a = addr & 0xFF;
                this.mem[a] = this.a & 0xFF;

                this.lastWrite = a;
                break;
            }
            case OP.PUSH_A: {
                this.push8(this.a);
                break;
            }
            case OP.POP_A: {
                this.a = this.pop8();
                this.z = (this.a === 0) ? 1 : 0;
                break;
            }
            case OP.HALT:
            default:
                this.halted = true;
                break;
        }

        // -- trace: after --
        const a1 = this.a & 0xFF;
        const b1 = this.b & 0xFF;
        const z1 = this.z & 0xFF;
        const pc1 = this.pc & 0xFF;
        const sp1 = this.sp & 0xFF;

        const name = OP_NAME[op] ?? `OP_${hex2(op)}`;
        const opStr = (operand === null) ? name : `${name} ${hex2(operand)}`;

        const dA = (a0 !== a1) ? `${hex2(a0)}→${hex2(a1)}` : `${hex2(a1)}`;
        const dB = (b0 !== b1) ? `${hex2(b0)}→${hex2(b1)}` : `${hex2(b1)}`;
        const dZ = (z0 !== z1) ? `${z0}→${z1}` : `${z1}`;
        const dSP = (sp0 !== sp1) ? `${hex2(sp0)}→${hex2(sp1)}` : `${hex2(sp1)}`;

        const line = `PC=${hex2(pc0)}  ${opStr.padEnd(14)} | A=${dA} B=${dB} Z=${dZ} SP=${dSP} -> PC=${hex2(pc1)}${this.halted ? " (HALT)" : ""}`;

        this.trace.push(line);
        if (this.trace.length > 200) this.trace.shift();
    }
}


// ==================
// UI
// ==================

// --- Register ---
const elPC = document.getElementById("pc");
const elA = document.getElementById("a");
const elB = document.getElementById("b");
const elZ = document.getElementById("z");
const elSP = document.getElementById("sp");

// --- ROM (bytes) ---
const elROM = document.getElementById("rom");

// --- Output ---
const elOut = document.getElementById("out");

// --- Memory (00-FF) ---
const elMem = document.getElementById("mem");

// --- Trace ---
const elTrace = document.getElementById("trace");

// --- ASM ---
const elAsm = document.getElementById("asm");
const elAsmErr = document.getElementById("asmErr");

// --- Break Point ---
const elBpInput = document.getElementById("bpInput");
const btnBpClear = document.getElementById("bpClear");
const elBpView = document.getElementById("bpView");
let breakAddr = null;

// --- Speed ---
const elSpeed = document.getElementById("speed");
const elSpeedLabel = document.getElementById("speedLabel");
let runIntervalMs = 50;

// --- Control Button ---
const btnAssemble = document.getElementById("assembleBtn")
const btnStep = document.getElementById("step");
const btnRun = document.getElementById("run");
const btnStop = document.getElementById("stop");
const btnReset = document.getElementById("reset");

const cpu = new CPU();

let PROGRAM = new Uint8Array([]);

const DEFAULT_ASM = `
; countdown stored in RAM[0x80]
; - load initial value
; - loop: print, compare, decrement, store
; - exit when value becomes 0

    LDA_IMM 5
    STA_MEM 0x80

loop:
    LDA_MEM 0x80
    PRINTA

    ; if A == 0 -> end
    CMP_A_IMM 0
    JZ end

    ; A = A - 1
    SUB_A_IMM 1
    STA_MEM 0x80

    ; continue loop while A != 0
    CMP_A_IMM 0
    JNZ loop

end:
    HALT
`.trim();


elAsm.value = DEFAULT_ASM;

function stopRunIfNeeded() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    btnRun.disabled = false;
    btnStop.disabled = true;
}

function doAssemble() {
    stopRunIfNeeded();

    try {
        PROGRAM = assemble(elAsm.value);
        elAsmErr.textContent = "";

        cpu.load(PROGRAM);

        render();
    } catch (e) {
        elAsmErr.textContent = String(e.message || e);
    }
}

function parseAddr(s) {
    const t = (s ?? "").trim();
    if (!t) return null;
    const n = t.startsWith("0x") ? parseInt(t, 16) : parseInt(t, 10);
    return Number.isFinite(n) ? (n & 0xFF) : null;
}


// ==================
// Render
// ==================
function renderROM() {
    // PCの位置をハイライト
    let s = "";
    for (let i = 0; i < PROGRAM.length; i++) {
        const byte = `${hex2(i)}: ${hex2(cpu.mem[i])}`;
        s += (i === cpu.pc ? `<span class="line-hi">${byte}</span>` : byte) + "\n";
    }
    elROM.innerHTML = s || "(empty)";
}

function renderMemory(mem, pc, lastWrite) {
    // mem: Uint8Array(256), pc: 0..255
    const lines = [];
    for (let base = 0; base < 256; base += 16) {
        const cells = [];
        for (let i = 0; i < 16; i++) {
            const addr = base + i;
            const b = mem[addr] & 0xFF;

            let cls = "cell";
            if (addr === pc) cls += " hi-pc";
            if (lastWrite !== null && addr === lastWrite) cls += " hi-write";

            cells.push(`<span class="${cls}">${hex2(b)}</span>`);
        }

        const inLine = (pc >= base && pc < base + 16);
        const prefix = inLine ? "▶ " : "  ";
        lines.push(`${prefix}<span class="addr">${hex2(base)}:</span> ${cells.join(" ")}`);
    }
    return lines.join("\n");
}

function renderBp() {
    elBpView.textContent = breakAddr === null ? "(none)" : `$${hex2(breakAddr)} (${breakAddr})`;
}

function renderSpeed() {
    if (!elSpeed || !elSpeedLabel) return;
    elSpeedLabel.textContent = `${runIntervalMs}ms`;
}

function render() {
    elPC.textContent = `$${hex2(cpu.pc)} (${cpu.pc})`;
    elA.textContent = `$${hex2(cpu.a)} (${cpu.a})`;
    elB.textContent = `$${hex2(cpu.b)} (${cpu.b})`;
    elZ.textContent = `${cpu.z}`;
    elSP.textContent = `$${hex2(cpu.sp)} (${cpu.sp})`;

    renderROM();
    const lines = cpu.output.slice(-50);

    elOut.textContent = lines.join("\n") + (cpu.halted ? "\n\n(HALTED)" : "");

    elMem.innerHTML = renderMemory(cpu.mem, cpu.pc, cpu.lastWrite);

    elTrace.textContent = cpu.trace.slice(-80).join("\n");
    elTrace.scrollTop = elTrace.scrollHeight;
}


// ==================
// Controls
// ==================
let timer = null;

function runLoop() {
    for (let i = 0; i < 5; i++) {

        // -- BREAK POINT CHECK --
        if (breakAddr !== null && cpu.pc === breakAddr) {
            cpu.trace.push(`[BREAK] PC=${hex2(cpu.pc)}`);
            stopRunIfNeeded();
            render();
            return;
        }

        cpu.step();
        if (cpu.halted) break;
    }
    render();

    if (cpu.halted) {
        stopRunIfNeeded();
    }
}

elBpInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const v = parseAddr(elBpInput.value);
    breakAddr = v;
    renderBp();
})

btnBpClear.addEventListener("click", () => {
    breakAddr = null;
    elBpInput.value = "";
    renderBp();
})

btnAssemble.addEventListener("click", doAssemble);

btnStep.addEventListener("click", () => {
    cpu.step();
    render();
});

btnRun.addEventListener("click", () => {
    if (timer) return;
    btnRun.disabled = true;
    btnStop.disabled = false;

    timer = setInterval(runLoop, runIntervalMs);
});

btnStop.addEventListener("click", () => {
    stopRunIfNeeded();
    render();
});

btnReset.addEventListener("click", () => {
    stopRunIfNeeded();
    cpu.load(PROGRAM);
    render();
});

function restartTimerIfRunning() {
    if (!timer) return;
    clearInterval(timer);
    timer = setInterval(runLoop, runIntervalMs);
}

if (elSpeed) {
    runIntervalMs = Number(elSpeed.value);
    renderSpeed();

    elSpeed.addEventListener("input", () => {
        runIntervalMs = Number(elSpeed.value);
        renderSpeed();
        restartTimerIfRunning();
    });
}

doAssemble();
renderBp();
renderSpeed();