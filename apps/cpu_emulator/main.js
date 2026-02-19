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
    ADC:        0x08,   // A = A + B + C

    JMP:        0x10,   // PC = addr
    JZ:         0x11,   // if Z==1: PC = addr
    JNZ:        0x12,   // if Z==0: PC = addr

    LDA_MEM:    0x20,   // A = mem[addr], Z set
    STA_MEM:    0x21,   // mem[addr] = A

    PUSH_A:     0x30,   // mem[SP] = A, SP = SP-1
    POP_A:      0x31,   // SP = SP+1, A = mem[SP]
    PUSH_B:     0x32,   // mem[SP] = B, SP = SP-1
    POP_B:      0x33,   // SP = SP+1, B = mem[SP]
    CALL:       0x34,   // CALL addr (push return PC, then jump)
    RET:        0x35,   // RET (pop PC)

    HALT:       0xFF
};

const OP_NAME = Object.fromEntries(Object.entries(OP).map(([k, v]) => [v, k]));

const INSTRUCTION_REF = {
    LDA_IMM: {
        opcode: 0x01,
        format: "LDA_IMM imm8",
        desc: "Aレジスタに即値をロード",
        detail: "A = value\nZ = (A == 0)",
        example: "LDA_IMM 5  ; A=5\nLDA_IMM 0xFF  ; A=255"
    },
    LDB_IMM: {
        opcode: 0x02,
        format: "LDB_IMM imm8",
        desc: "Bレジスタに即値をロード",
        detail: "B = value\nZ = (B == 0)",
        example: "LDB_IMM 10  ; B=10"
    },
    ADD: {
        opcode: 0x03,
        format: "ADD",
        desc: "A と B を加算",
        detail: "A = (A + B) & 0xFF\nC = キャリーフラグ\nZ = ゼロフラグ",
        example: "LDA_IMM 10\nLDB_IMM 20\nADD   ; A = 30"
    },
    ADC: {
        opcode: 0x08,
        format: "ADC",
        desc: "A と B と キャリー を加算",
        detail: "A = (A + B + C) & 0xFF\nC = キャリーフラグ\nZ = ゼロフラグ",
        example: "; 16bit加算の上位バイト\nADC      ; A = A + B + C"
    },
    PRINTA: {
        opcode: 0x04,
        format: "PRINTA",
        desc: "Aレジスタの値を出力",
        detail: "Output に A の値を追加",
        example: "LDA_IMM 42\nPRINTA   ; Output: 42"
    },
    DEC_A: {
        opcode: 0x05,
        format: "DEC_A",
        desc: "A を 1 減らす",
        detail: "A = (A - 1) & 0xFF\nZ = (A == 0)",
        example: "LDA_IMM 5\nDEC_A      ; A = 4"
    },
    CMP_A_IMM: {
        opcode: 0x06,
        format: "CMP_A_IMM value",
        desc: "A と即値を比較 (Aは変更なし)",
        detail: "r = (A - value) & 0xFF\nZ = (r == 0)",
        example: "CMP_A_IMM 0\nJZ end   ; if A == 0 then jump to end"
    },
    SUB_A_IMM: {
        opcode: 0x07,
        format: "SUB_A_IMM value",
        desc: "A から即値を減算",
        detail: "A = (A - value) & 0xFF\nZ = (A == 0)",
        example: "LDA_IMM 10\nSUB_A_IMM 3   ; A = 7"
    },
    JMP: {
        opcode: 0x10,
        format: "JMP addr",
        desc: "無条件ジャンプ",
        detail: "PC = addr",
        example: "loop:\n   PRINTA\n    JMP loop    ; 無限ループ"
    },
    JZ: {
        opcode: 0x11,
        format: "JZ addr",
        desc: "Z == 1 のときジャンプ",
        detail: "if Z == 1 then PC = addr",
        example: "CMP_A_IMM 0\nJZ end       ; if A == 0 then jump to end"
    },
    JNZ: {
        opcode: 0x12,
        format: "JNZ addr",
        desc: "Z == 0 のときジャンプ",
        detail: "if Z == 0 then PC = addr",
        example: "DEC_A\nJNZ loop   ; if A != 0 then jump to loop"
    },
    LDA_MEM: {
        opcode: 0x20,
        format: "LDA_MEM addr",
        desc: "メモリから A にロード",
        detail: "A = mem[addr]\nZ = (A == 0)",
        example: "LDA_MEM 0x80 ; A = mem[0x80]"
    },
    STA_MEM: {
        opcode: 0x21,
        format: "STA_MEM addr",
        desc: "A をメモリにストア",
        detail: "mem[addr] = A",
        example: "LDA_IMM 42\nSTA_MEM 0x80 ; mem[0x80] = 42"
    },
    PUSH_A: {
        opcode: 0x30,
        format: "PUSH_A",
        desc: "A をスタックに保存",
        detail: "mem[SP] = A\nSP = SP - 1",
        example: "LDA_IMM 10\nPUSH_A        ; スタックに保存"
    },
    POP_A: {
        opcode: 0x31,
        format: "POP_A",
        desc: "スタックから A に復元",
        detail: "SP = SP + 1\nA = mem[SP]\nZ = (A == 0)",
        example: "POP_A     ; スタックから復元"
    },
    PUSH_B: {
        opcode: 0x32,
        format: "PUSH_B",
        desc: "B をスタックに保存",
        detail: "mem[SP] = B\nSP = SP - 1",
        example: "LDB_IMM 10\nPUSH_B        ; スタックに保存"
    },
    POP_B: {
        opcode: 0x33,
        format: "POP_B",
        desc: "スタックから B に復元",
        detail: "SP = SP + 1\nB = mem[SP]\nZ = (B == 0)",
        example: "POP_B"
    },
    CALL: {
        opcode: 0x34,
        format: "CALL addr",
        desc: "サブルーチン呼び出し",
        detail: "戻り先を保存してジャンプ\npush(PC)\nPC = addr",
        example: "CALL func    ; func を呼び出し"
    },
    RET: {
        opcode: 0x35,
        format: "RET",
        desc: "サブルーチンから復帰",
        detail: "PC = pop()",
        example: "func:\n  PRINTA\n  RET        ; 呼び出し元に戻る"
    },
    HALT: {
        opcode: 0xFF,
        format: "HALT",
        desc: "CPU停止",
        detail: "実行を停止",
        example: "PRINTA\nHALT         ; 終了"
    }
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
    CMP_A_IMM:  2,
    SUB_A_IMM:  2,
    ADC:        1,
    JMP:        2,
    JZ:         2,
    JNZ:        2,
    LDA_MEM:    2,
    STA_MEM:    2,
    PUSH_A:     1,
    POP_A:      1,
    PUSH_B:     1,
    POP_B:      1,
    CALL:       2,
    RET:        1,
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

    // 0. .equ による定数定義を取得
    const constants = new Map();

    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
        const raw = lines[lineNo].trim();
        if (!raw || raw.startsWith(";")) continue;

        // NAME .equ VALUE のパターン
        const equMatch = raw.match(/^([A-Za-z_]\w*)\s+\.equ\s+(.+)$/i);
        if (equMatch) {
            const name = equMatch[1];
            const valueStr = equMatch[2].split(";")[0].trim();
            const value = parseNumber(valueStr);

            if (value == null) {
                throw new Error(`Invalid .equ value "${valueStr}" at line ${lineNo + 1}`);
            }
            if (constants.has(name)) {
                throw new Error(`Duplicate constant "${name}" at line ${lineNo + 1}`);
            }

            constants.set(name, value & 0xFF);
        }
    }

    // 1. lebel -> addr
    const labels = new Map();
    let pc = 0;

    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
        const raw = lines[lineNo].trim();
        if (!raw || raw.startsWith(";")) continue;

        // .equ 行をスキップ
        if (/^[A-Za-z_]\w*\s+\.equ\s+/i.test(raw)) continue;
        
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

        // .equ 行はスキップ
        if (/^[A-Za-z_]\w*\s+\.equ\s+/i.test(raw)) continue;

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
                if (constants.has(operandToken)) {
                    val = constants.get(operandToken);
                } else if (labels.has(operandToken)) {
                    val = labels.get(operandToken);
                } else {
                    throw new Error(`Unknown label: "${operandToken}" at line ${lineNo + 1}`);
                }
            }

            out.push(val & 0xFF);
            pc++;
        }
    }

    return new Uint8Array(out);
}

// ==================
// Disassembler
// ==================
function disassemle(mem, addr) {
    const opcode = mem[addr] & 0xFF;
    const opName = OP_NAME[opcode];

    // 未定義の命令の場合
    if (!opName) {
        return {
            addr: addr,
            size: 1,
            opcode: opcode,
            opName: `DB`,   // Define Byte (未定義の命令)
            operand: null,
            text: `DB 0x${hex2(opcode)}`
        };
    }

    const size = INSTR_SIZE[opName];
    let operand = null;
    let text = opName;

    // 2バイト命令の場合, オペランドを読み取る
    if (size === 2) {
        operand = mem[(addr + 1) & 0xFF] & 0xFF;
        text = `${opName} 0x${hex2(operand)}`;
    }

    return {
        addr: addr,
        size: size,
        opcode: opcode,
        opName: opName,
        operand: operand,
        text: text
    };
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
        this.c = 0;
        this.sp = 0xFF;

        // state
        this.halted = false;
        this.output = [];
        this.watchHit = null;

        // latest write
        this.lastWrite = null;

        // trace log
        this.trace = [];

        // step back
        this.history = [];
        this.maxHistory = 100;
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

        if (watchAddr !== null && this.sp === watchAddr) {
            this.watchHit = this.sp;
        }

        this.sp = (this.sp - 1) & 0xFF;
    }

    pop8() {
        this.sp = (this.sp + 1) & 0xFF;
        return this.mem[this.sp] & 0xFF;
    }

    step() {
        if (this.halted) return;

        // 実行前の状態を保存
        this.saveSnapshot();

        // --  trace: before --
        const pc0 = this.pc & 0xFF;
        const a0 = this.a & 0xFF;
        const b0 = this.b & 0xFF;
        const z0 = this.z & 0xFF;
        const c0 = this.c & 0xFF;
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
                const result = (this.a + this.b);
                this.c = (result > 0xFF) ? 1 : 0; // 8bitを超えたら Carry = 1
                this.a = (this.a  + this.b) & 0xFF;
                this.z = (this.a === 0) ? 1 : 0;
                break;
            }
            case OP.ADC: {
                const result = (this.a + this.b + this.c);
                this.c = (result > 0xFF) ? 1 : 0;
                this.a = result & 0xFF;
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

                if (watchAddr !== null && a === watchAddr) {
                    this.watchHit = a;
                }

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
            case OP.PUSH_B: {
                this.push8(this.b);
                break;
            }
            case OP.POP_B: {
                this.b = this.pop8();
                this.z = (this.b === 0) ? 1 : 0;
                break;
            }
            case OP.CALL: {
                const addr = this.fetch();
                operand = addr & 0xFF;

                const returnPC = this.pc & 0xFF;

                this.push8(returnPC);
                this.pc = addr &  0xFF;
                break;
            }
            case OP.RET: {
                this.pc = this.pop8() & 0xFF;
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
        const c1 = this.c & 0xFF;
        const pc1 = this.pc & 0xFF;
        const sp1 = this.sp & 0xFF;

        const name = OP_NAME[op] ?? `OP_${hex2(op)}`;
        const opStr = (operand === null) ? name : `${name} ${hex2(operand)}`;

        const dA = (a0 !== a1) ? `${hex2(a0)}→${hex2(a1)}` : `${hex2(a1)}`;
        const dB = (b0 !== b1) ? `${hex2(b0)}→${hex2(b1)}` : `${hex2(b1)}`;
        const dZ = (z0 !== z1) ? `${z0}→${z1}` : `${z1}`;
        const dC = (c0 !== c1) ? `${c0}→${c1}` : `${c1}`;
        const dSP = (sp0 !== sp1) ? `${hex2(sp0)}→${hex2(sp1)}` : `${hex2(sp1)}`;

        const line = `PC=${hex2(pc0)}  ${opStr.padEnd(14)} | A=${dA} B=${dB} Z=${dZ} C=${dC} SP=${dSP} -> PC=${hex2(pc1)}${this.halted ? " (HALT)" : ""}`;

        this.trace.push(line);
        if (this.trace.length > 200) this.trace.shift();
    }

    saveSnapshot() {
        const snapshot = {
            // registers
            pc: this.pc,
            a: this.a,
            b: this.b,
            z: this.z,
            c: this.c,
            sp: this.sp,

            // memory
            mem: new Uint8Array(this.mem),

            // state
            halted: this.halted,
            output: [...this.output],
            lastWrite: this.lastWrite,
            trace: [...this.trace]
        };

        this.history.push(snapshot);

        // 履歴が多い場合は古いものから削除
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    restoreSnapshot(snapshot) {
        if (!snapshot) return false;

        // registers
        this.pc = snapshot.pc;
        this.a = snapshot.a;
        this.b = snapshot.b;
        this.z = snapshot.z;
        this.c = snapshot.c;
        this.sp = snapshot.sp;

        // memory
        this.mem.set(snapshot.mem);

        // state
        this.halted = snapshot.halted;
        this.output = [...snapshot.output];
        this.lastWrite = snapshot.lastWrite;
        this.trace = [...snapshot.trace];

        return true;
    }

    canStepBack() {
        return this.history.length > 0;
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
const elC = document.getElementById("c");
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
const elSampleSelect = document.getElementById("sampleSelect");
const elAsm = document.getElementById("asm");
const elAsmErr = document.getElementById("asmErr");

// --- Break Point ---
const elBpInput = document.getElementById("bpInput");
const btnBpClear = document.getElementById("bpClear");
const elBpView = document.getElementById("bpView");
let breakAddr = null;

// --- Watch Point ---
const elWpInput = document.getElementById("wpInput");
const btnWpClear = document.getElementById("wpClear");
const elWpView = document.getElementById("wpView");
let watchAddr = null;

// --- Speed ---
const elSpeed = document.getElementById("speed");
const elSpeedLabel = document.getElementById("speedLabel");
let runIntervalMs = 50;

// --- Control Button ---
const btnAssemble = document.getElementById("assembleBtn")
const btnStepBack = document.getElementById("stepBack");
const btnStep = document.getElementById("step");
const btnRun = document.getElementById("run");
const btnStop = document.getElementById("stop");
const btnReset = document.getElementById("reset");
const btnHelpToggle = document.getElementById("helpToggle");

// --- Help Panel ---
const elHelpPanel = document.getElementById("helpPanel");
const btnHelpClose = document.getElementById("helpClose");
const elHelpContent = document.getElementById("helpContent");

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

// ==================
// Sample Programs
// ==================
const SAMPLES = {
    countdown: `
; === Countdown ===
; RAM[0x80] にカウントダウンの値を保存しながら
; 5 > 4 > 3 > 2 > 1 > 0 と出力するサンプル
COUNTER .equ 0x80

    LDA_IMM 5
    STA_MEM COUNTER

loop:
    LDA_MEM COUNTER
    PRINTA

    CMP_A_IMM 0
    JZ end

    SUB_A_IMM 1
    STA_MEM COUNTER

    CMP_A_IMM 0
    JNZ loop

end:
    HALT`,

    fibonacci: `
; === Fibonacci ===
; F(0)=0, F(1)=1, F(2)=1, F(3)=2, F(4)=3, F(5)=5, F(6)=8
;
; 使用RAM:
;   0x80 = prev (前の値)
;   0x81 = curr (現在の値)
;   0x82 = loop counter (ループ回数)
;   0x83 = tmp (計算の一時保存用)
PREV .equ 0x80
CURR .equ 0x81
COUNT .equ 0x82
TMP .equ 0x83

    ; prev = 0, curr = 1
    LDA_IMM 0
    STA_MEM PREV
    LDA_IMM 1
    STA_MEM CURR

    ; counter = 7
    LDA_IMM 7
    STA_MEM COUNT

    ; print F(0) = 0
    LDA_MEM PREV
    PRINTA

loop:
    ; print curr
    LDA_MEM CURR
    PRINTA

    ; B = curr
    LDA_MEM CURR
    PUSH_A
    POP_B

    ; A = prev
    LDA_MEM PREV

    ; A = next = prev + curr
    ADD

    ; next を一時保存
    STA_MEM TMP

    ; prev = curr
    LDA_MEM CURR
    STA_MEM PREV

    ; curr = next
    LDA_MEM TMP
    STA_MEM CURR

    ; counter--
    LDA_MEM COUNT
    DEC_A
    STA_MEM COUNT
    JZ end
    JMP loop

end:
    HALT`,

    addition: `
; === 8bit Addiction ===
; 3 + 5 を計算して結果を出力する
; レジスタ A と B を使った最もシンプルな加算

    LDA_IMM 3
    LDB_IMM 5
    ADD
    PRINTA
    HALT`,

    addition16: `
; === 16bit Addiction ===
; 0x01FF + 0x0001 = 0x0200 を計算する
;
; 16bit値を「上位バイト」「下位バイト」に分けて管理
;
; 使用RAM:
;   0x80 = 結果の下位バイト
;   0x81 = 結果の上位バイト
;
; 計算:
;   下位: 0xFF + 0x01 -> ADD -> 0x00 (C=1)
;   上位: 0x01 + 0x00 -> ADC -> 0x02 (Cを引き継ぎ)
RESULT_LO .equ 0x80
RESULT_HI .equ 0x81

    ; --- 下位バイトの加算 ---
    LDA_IMM 0xFF    ; A = 下位 (0x01FF)
    LDB_IMM 0x01    ; B = 下位 (0x0001)
    ADD             ; A = 0x00, C = 1
    STA_MEM RESULT_LO    ; 結果の下位バイトを保存
    
    ; --- 上位バイトの加算 (キャリー引継ぎ) ---
    LDA_IMM 0x01   ; A = 上位 (0x01FF)
    LDB_IMM 0x00   ; B = 上位 (0x0001)
    ADC            ; A = 0x02, C = 0
    STA_MEM RESULT_HI   ; 結果の上位バイトを保存

    ; --- 結果の出力 ---
    LDA_MEM RESULT_HI
    PRINTA         ; 上位バイトを出力 (0x02)
    LDA_MEM RESULT_LO
    PRINTA         ; 下位バイトを出力 (0x00)

    ; -> 0x0200 = 512 を2バイトで表現
    HALT`
};


elAsm.value = DEFAULT_ASM;

function stopRunIfNeeded() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    btnRun.disabled = false;
    btnStop.disabled = true;
    updateStepBackButton();
}

function doAssemble() {
    stopRunIfNeeded();

    try {
        PROGRAM = assemble(elAsm.value);
        elAsmErr.textContent = "";

        cpu.load(PROGRAM);

        cpu.history = [];

        render();

        showToast(`✓ Assembled: ${PROGRAM.length} bytes`);
    } catch (e) {
        elAsmErr.textContent = String(e.message || e);

        showToast(`✗ Assembly failed`, true);
    }
}

function parseAddr(s) {
    const t = (s ?? "").trim();
    if (!t) return null;
    const n = t.startsWith("0x") ? parseInt(t, 16) : parseInt(t, 10);
    return Number.isFinite(n) ? (n & 0xFF) : null;
}

// ==================
// Toast Notification
// ==================
const elToast = document.getElementById("toast");
let toastTimer = null;

function showToast(message, isError = false) {
    // 既存のタイマーをクリア
    if (toastTimer) {
        clearTimeout(toastTimer);
    }

    // トースト表示
    elToast.textContent = message;
    elToast.classList.toggle("error", isError);
    elToast.classList.add("show");

    // 2s後に非表示
    toastTimer = setTimeout(() => {
        elToast.classList.remove("show");
    }, 2000);
}


// ==================
// Render
// ==================
function renderROM() {
    let s = "";
    let addr = 0;

    while (addr < PROGRAM.length) {
        const dis = disassemle(cpu.mem, addr);

        // バイト列の構築
        let bytes = hex2(dis.opcode);
        if (dis.size == 2 && addr + 1 < cpu.mem.length) {
            bytes += ` ${hex2(cpu.mem[addr + 1])}`;
        }
        bytes = bytes.padEnd(8);

        // 行全体
        const line = `${hex2(addr)}: ${bytes} ${dis.text}`;

        // PCハイライト
        if (addr === cpu.pc) {
            s += `<span class="line-hi">${line}</span>\n`;
        } else {
            s += line + "\n";
        }

        addr += dis.size;
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
            if (watchAddr !== null && addr === watchAddr) cls += " hi-watch";

            cells.push(`<span class="${cls}" data-addr="${addr}">${hex2(b)}</span>`);
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

function renderWp() {
    elWpView.textContent = watchAddr === null ? "(none)" : `$${hex2(watchAddr)} (${watchAddr})`;
    render();
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
    elC.textContent = `${cpu.c}`;
    elSP.textContent = `$${hex2(cpu.sp)} (${cpu.sp})`;

    renderROM();
    const lines = cpu.output.slice(-50);

    elOut.textContent = lines.join("\n") + (cpu.halted ? "\n\n(HALTED)" : "");

    elMem.innerHTML = renderMemory(cpu.mem, cpu.pc, cpu.lastWrite);

    elTrace.textContent = cpu.trace.slice(-80).join("\n");
    elTrace.scrollTop = elTrace.scrollHeight;

    updateStepBackButton();
}

// ==================
// Help Panel
// ==================
function toggleHelpPanel() {
    elHelpPanel.classList.toggle("hidden");
}

function renderHelpContent() {
    const cards = Object.entries(INSTRUCTION_REF).map(([name, info]) => {
        return `
<div class="instr-card">
    <div class="isntr-header">
        <span class="instr-name">${name}</span>
        <span class="instr-opcode">0x${hex2(info.opcode)}</span>
    </div>
    <div class="instr-format">${info.format}</div>
    <div class="instr-desc">${info.desc}</div>
    <div class="instr-detail">${info.detail}</div>
    <div class="instr-example">${info.example}</div>
</div>`.trim();
    });

    elHelpContent.innerHTML = cards.join('\n');
}

// ==================
// Memory Editor
// ==================
const elMemEdit = document.getElementById("memEdit");

let editingAddr = null;

elMem.addEventListener("click", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;

    const addr = parseInt(cell.dataset.addr, 10);
    if (!Number.isFinite(addr)) return;

    startEditMemory(addr, cell);
});

function startEditMemory(addr, cellElement) {
    editingAddr = addr;

    // 編集中クラスを追加
    cellElement.classList.add("editing");

    // セルの位置を取得
    const rect = cellElement.getBoundingClientRect();
    const memRect = elMem.getBoundingClientRect();

    // input要素を配置
    elMemEdit.style.display = "block";
    elMemEdit.style.left = (rect.left - memRect.left + elMem.scrollLeft) + "px";
    elMemEdit.style.top = (rect.top - memRect.top + elMem.scrollTop) + "px";
    elMemEdit.value = hex2(cpu.mem[addr]);

    elMemEdit.focus();
    elMemEdit.select();
}

elMemEdit.addEventListener("blur", () => {
    // 編集中クラスを削除
    document.querySelector("#mem .cell.editing")?.classList.remove("editing");

    elMemEdit.style.display = "none";
    editingAddr = null;
});

elMemEdit.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        commitMemoryEdit();
    } else if (e.key === "Escape") {
        // 編集中クラスを削除
        document.querySelector("#mem .cell.editing")?.classList.remove("editing");

        elMemEdit.style.display = "none";
        editingAddr = null;
    }
});

function commitMemoryEdit() {
    if (editingAddr === null) return;

    const input = elMemEdit.value.trim();

    // 空入力はキャンセル
    if (!input) {
        cancelMemoryEdit();
        return;
    }

    const val = parseNumber(input);

    if (val === null || val < 0 || val > 255) {
        // エラー表示
        elMemEdit.classList.add("error");
        elMemEdit.select();

        // 0.3s後にエラー状態を解除
        setTimeout(() => {
            elMemEdit.classList.remove("error");
        }, 300);

        return;
    }

    cpu.mem[editingAddr] = val & 0xFF;
    cpu.lastWrite = editingAddr;

    // 編集中クラスを削除
    document.querySelector("#mem .cell.editing")?.classList.remove("editing");

    elMemEdit.style.display = "none";
    editingAddr = null;
    render();
}

function cancelMemoryEdit() {
    document.querySelector("#mem .cell.editing")?.classList.remove("editing");
    elMemEdit.classList.remove("error");
    elMemEdit.style.display = "none";
    editingAddr = null;
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

        if (cpu.watchHit !== null) {
            cpu.trace.push(`[WATCH] Write to $${hex2(cpu.watchHit)}`);
            cpu.watchHit = null;
            stopRunIfNeeded();
            render();
            return;
        }

        if (cpu.halted) break;
    }
    render();

    if (cpu.halted) {
        stopRunIfNeeded();
    }
};

elBpInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const v = parseAddr(elBpInput.value);
    breakAddr = v;
    renderBp();
});

btnBpClear.addEventListener("click", () => {
    breakAddr = null;
    elBpInput.value = "";
    renderBp();
});

elWpInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const v = parseAddr(elWpInput.value);
    watchAddr = v;
    renderWp();
});

btnWpClear.addEventListener("click", () => {
    watchAddr = null;
    elWpInput.value = "";
    renderWp();
});

btnAssemble.addEventListener("click", doAssemble);

function updateStepBackButton() {
    btnStepBack.disabled = !cpu.canStepBack();
}

btnStepBack.addEventListener("click", () => {
    if (!cpu.canStepBack()) return;

    const snapshot = cpu.history.pop();
    cpu.restoreSnapshot(snapshot);

    // トレースに記録
    cpu.trace.push(`[STEP BACK] Restored to PC=${hex2(cpu.pc)}`);
    if (cpu.trace.length > 200) cpu.trace.shift();

    render();
    updateStepBackButton();
});

btnStep.addEventListener("click", () => {
    cpu.step();

    if (cpu.watchHit !== null) {
        cpu.trace.push(`[WATCH] Write to $${hex2(cpu.watchHit)}`);
        cpu.watchHit = null;
    }

    render();
    updateStepBackButton();
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

    cpu.history = [];

    render();
});

btnHelpToggle.addEventListener("click", () => {
    toggleHelpPanel();
});

btnHelpClose.addEventListener("click", () => {
    elHelpPanel.classList.add("hidden");
});

elSampleSelect.addEventListener("change", () => {
    const key = elSampleSelect.value;
    if (!key) return;
    elAsm.value = SAMPLES[key];
    doAssemble();
    elSampleSelect.value = "";
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

// ==================
// Controls
// ==================
document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        doAssemble();
    }
})



doAssemble();
renderBp();
renderWp();
renderSpeed();
updateStepBackButton();
renderHelpContent();