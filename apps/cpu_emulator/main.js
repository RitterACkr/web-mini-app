// ==================
// Opcodes
// ==================
const OP = {
    LDA_IMM: 0x01,  // A = imm8
    LDB_IMM: 0x02,  // B = imm8
    ADD:     0x03,  // A = (A+B)&25, Z set
    PRINTA:  0x04,  // print A
    HALT:    0xFF
};

function hex2(n) {
    return n.toString(16).toUpperCase().padStart(2, "0");
}

// サンプルプログラム
// 5 + 7 -> 12 を出力
const ROM = new Uint8Array([
    OP.LDA_IMM, 5,
    OP.LDB_IMM, 7,
    OP.ADD,
    OP.PRINTA,
    OP.HALT
]);

class CPU {
    constructor(rom) {
        this.rom = rom;
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

    fetch() { 
        // PCが範囲外ならHALT扱い
        const v = this.rom[this.pc];
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

const cpu = new CPU(ROM);

function renderROM() {
    // PCの位置をハイライト
    let s = "";
    for (let i = 0; i < ROM.length; i++) {
        const byte = `${hex2(i)}: ${hex2(ROM[i])}`;
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
    elOut.textContent = cpu.output.join("\n") + (cpu.halted ? "\n\n(HALTED)" : "");
}

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
    btnRun.disabled = false;
    btnStop.disabled = true;
    render();
});

render();