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

// サンプルプログラム
// - RAMの導入
const VAR_ADDR = 0x80;  // 80

// print Aの無限ループ (STOPで止める)
const PROGRAM = new Uint8Array([
    OP.LDA_IMM, 5,          // 00 01
    OP.STA_MEM, VAR_ADDR,   // 02 03

    OP.LDA_MEM, VAR_ADDR,   // 04 05
    OP.PRINTA,              // 06
    OP.DEC_A,               // 07
    OP.STA_MEM, VAR_ADDR,   // 08 09
    OP.JZ, 0x0E,            // 0A 0B
    OP.JMP, 0x04,           // 0C 0D

    OP.LDA_MEM, VAR_ADDR,   // 0E 0F
    OP.PRINTA,              // 10
    OP.HALT                 // 11
]);

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

const btnStep = document.getElementById("step");
const btnRun = document.getElementById("run");
const btnStop = document.getElementById("stop");
const btnReset = document.getElementById("reset");

const cpu = new CPU();

// サンプルプログラムの実行
cpu.load(PROGRAM);



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
    elROM.innerHTML = s;
}

function render() {
    elPC.textContent = `$${hex2(cpu.pc)} (${cpu.pc})`;
    elA.textContent = `$${hex2(cpu.a)} (${cpu.a})`;
    elB.textContent = `$${hex2(cpu.b)} (${cpu.b})`;
    elZ.textContent = `${cpu.z}`;
    renderROM();
    const lines = cpu.output.slice(-50);
    elOut.textContent = lines.join("\n") + (cpu.halted ? "\n\n(HALTED)" : "");
}


// ==================
// Controls
// ==================
let timer = null;

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
            clearInterval(timer);
            timer = null;
            btnRun.disabled = false;
            btnStop.disabled = true;
        }
    }, 50);
});

btnStop.addEventListener("click", () => {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    btnRun.disabled = false;
    btnStop.disabled = true;
    render();
});

btnReset.addEventListener("click", () => {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    cpu.reset();
    cpu.load(PROGRAM);
    btnRun.disabled = false;
    btnStop.disabled = true;
    render();
});

render();