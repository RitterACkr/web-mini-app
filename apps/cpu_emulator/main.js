// ==================
// Opcodes
// ==================
const OP = {
    LDA_IMM: 0x01,  // A = imm8
    LDB_IMM: 0x02,  // B = imm8
    ADD:     0x03,  // A = (A+B)&0xFF, Z set
    PRINTA:  0x04,  // print A
    DEC_A:   0x05,  // A = (A-1)&0xFF, Z set

    JMP:     0x10,  // PC = addr
    JZ:      0x11,  // if Z==1: PC = addr

    LDA_MEM: 0x20,  // A = mem[addr], Z set
    STA_MEM: 0x21,  // mem[addr] = A

    HALT:    0xFF
};

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
    LDA_MEM:    2,
    STA_MEM:    2,
    JMP:        2,
    JZ:         2,
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
        // registers
        this.pc = 0;
        this.a = 0;
        this.b = 0;
        this.z = 0;

        // state
        this.halted = false;
        this.output = [];
    }

    load(program, startAddr = 0x00) {
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

    step() {
        if (this.halted) return;

        const op = this.fetch();

        switch(op) {
            case OP.LDA_IMM: {
                const imm = this.fetch();
                this.a = imm & 0xFF;
                this.z = (this.a === 0) ? 1 : 0;
                break;
            }
            case OP.LDB_IMM: {
                const imm = this.fetch();
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
            case OP.LDA_MEM: {
                const addr = this.fetch();
                this.a = this.mem[addr & 0xFF];
                this.z = (this.a === 0) ? 1 : 0;
                break;
            }
            case OP.STA_MEM: {
                const addr = this.fetch();
                this.mem[addr & 0xFF] = this.a & 0xFF;
                break;
            }
            case OP.JMP: {
                const addr = this.fetch();
                this.pc = addr & 0xFF;
                break;
            }
            case OP.JZ: {
                const addr = this.fetch();
                if (this.z === 1) {
                    this.pc = addr & 0xFF;
                }
                break;
            }
            case OP.HALT:
            default:
                this.halted = true;
                break;
        }
    }
}


// ==================
// UI
// ==================
const elPC = document.getElementById("pc");
const elA = document.getElementById("a");
const elB = document.getElementById("b");
const elZ = document.getElementById("z");
const elROM = document.getElementById("rom");
const elOut = document.getElementById("out");
const elMem = document.getElementById("#mem");

const elAsm = document.getElementById("asm");
const elAsmErr = document.getElementById("asmErr");

const btnAssemble = document.getElementById("assembleBtn")
const btnStep = document.getElementById("step");
const btnRun = document.getElementById("run");
const btnStop = document.getElementById("stop");
const btnReset = document.getElementById("reset");

const cpu = new CPU();

let PROGRAM = new Uint8Array([]);

const DEFAULT_ASM = `
; RAM variable countdown
; var Addr = 0x80

    LDA_IMM 5
    STA_MEM 0x80

loop:
    LDA_MEM 0x80
    PRINTA
    DEC_A
    STA_MEM 0x80
    JZ end
    JMP loop

end:
    LDA_MEM 0x80
    PRINTA
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

        cpu.reset();
        cpu.load(PROGRAM);

        render();
    } catch (e) {
        elAsmErr.textContent = String(e.message || e);
    }
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

function renderMemory() {
    // mem: Uint8Array(256), pc: 0..255
    const line = [];
    for (let base = 0; base < 256; base += 16) {
        const bytes = [];
        for (let i = 0; i < 16; i++) {
            const addr = base + i;
            const b = mem[addr];
            bytes.push(hex2(b));
        }
        const inLine = (pc >= base && pc < base + 16);
        const prefix = inLine ? "▶ " : "  ";
        lines.push(`${prefix}${hex(base)}: ${bytes.join(" ")}`);
    }
    return lines.join("\n");
}

function render() {
    elPC.textContent = `$${hex2(cpu.pc)} (${cpu.pc})`;
    elA.textContent = `$${hex2(cpu.a)} (${cpu.a})`;
    elB.textContent = `$${hex2(cpu.b)} (${cpu.b})`;
    elZ.textContent = `${cpu.z}`;

    renderROM();
    const lines = cpu.output.slice(-50);

    elOut.textContent = lines.join("\n") + (cpu.halted ? "\n\n(HALTED)" : "");

    elMem.textContent = renderMemory(cpu.mem, cpu.PC);
}


// ==================
// Controls
// ==================
let timer = null;

btnAssemble.addEventListener("click", doAssemble);

btnStep.addEventListener("click", () => {
    cpu.step();
    render();
});

btnRun.addEventListener("click", () => {
    if (timer) return;
    btnRun.disabled = true;
    btnStop.disabled = false;

    timer = setInterval(() => {
        // 少しずつ進める
        for (let i = 0; i < 5; i++) {
            cpu.step();
            if (cpu.halted) break;
        }
        render();

        if (cpu.halted) {
            stopRunIfNeeded();
        }
    }, 50);
});

btnStop.addEventListener("click", () => {
    stopRunIfNeeded();
    render();
});

btnReset.addEventListener("click", () => {
    stopRunIfNeeded();
    cpu.reset();
    cpu.load(PROGRAM);
    render();
});

doAssemble();