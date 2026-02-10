# Instruction Set (命令セット)

CPUは `命令` を順番に実行してプログラムを動かす

このプロジェクトでは命令を 1バイト (0..255) の数値で表す
```
0x01 = LDA_IMM
0x02 = LDB_IMM
0x03 = ADD
0x04 = PRINTA
0x05 = DEC_A
0x06 = CMP_A_IMM
0x07 = SUB_A_IMM

0x10 = JMP
0x11 = JZ
0x12 = JNZ

0x20 = LDA_MEM
0x21 = STA_MEM

0xFF = HALT
```

## opcode と operand
多くの命令は

- opcode : 命令本体 「何をするか」
- operand : 引数 「opcodeに対してどの値で行うか」

の2つから成る

```
例えば
LDA_IMM 5
はメモリ上では以下のように表される
0x00: 0x01 <- opcode
0x01: 0x05 <- operand

(PC=0では opcode=LDA_IMM を読む -> PC=1に移動)
(PC=1では immediate=5 を読む -> PC=2に移動)
```

### 命令ごとのバイト長
命令によっては operand の有無が異なるため,1命令が占めるバイト数は一定でない
```
ADD は読まれた時点でA += Bが行われるため, operand が必要ない
-> (1バイト命令)

LDA_IMM は引数 imm8 を持ち, operand を用いて指定する必要がある
-> (2バイト命令)
```

---

## このプロジェクトの命令セット

### LDA_IMM (0x01)

Aレジスタに即値 (imm8) をロードする
```
A = imm8
Z = (A == 0)

メモリ形式: [0x01][imm8]
```

### LDB_IMM (0x02)

Bレジスタに即値 (imm8) をロードする
```
B = imm8
Z = (B == 0)

メモリ形式: [0x02][imm8]
```

### ADD (0x03)

A と B を加算し, 結果を A に入れる
```
A = (A + B) & 0xFF
Z = (A == 0)

メモリ形式: [0x03]
```

### PRINTA (0x04)

Aレジスタの値を出力する (表示/ログに追加)
```
メモリ形式: [0x04]
```

### DEC_A (0x05)

A を 1　減らす
```
A = (A - 1) & 0xFF
Z = (A == 0)

メモリ形式: [0x05]
```

### CMP_A_IMM (0x06)

A を即値と比較する (Aの変更なし)
```
r = (A - imm8) & 0xFF
Z = (r == 0)

メモリ形式: [0x06][imm8]
```

### SUB_A_IMM (0x07)

A から即値を減算する
```
A = (A - imm8) & 0xFF
Z = (A == 0)

メモリ形式: [0x07][imm8]
```

### JMP (0x10)

無条件で指定されたアドレスへジャンプ
```
PC = addr

メモリ形式: [0x10][addr]
```

### JZ (0x11)

Z == 1 のとき指定されたアドレスへジャンプ
```
if (Z == 1) PC = addr

メモリ形式: [0x11][addr]
```

### JNZ (0x12)

Z == 0 のとき指定されたアドレスへジャンプ
```
if (Z == 0) PC = addr

メモリ形式: [0x12][addr]
```

### LDA_MEM (0x20)

メモリから A へロード
```
A = mem[addr]
Z = (A == 0)

メモリ形式: [0x20][addr]
```

### STA_MEM (0x21)

A をメモリへストア
```
mem[addr] = A

メモリ形式: [0x21][addr]
```

### HALT (0xFF)

CPUを停止する
```
メモリ形式: [0xFF]
```

---

## 実際のプログラム例

### 「5 + 7を計算して出力するプログラム」
```
LDA_IMM 5
LDB_IMM 7
ADD
PRINTA
HALT
```
バイト列 (16進):
```
01 05  02 07  03  04  FF
```

### 「RAM を使ったカウントダウン」
```
; RAM[0x80]にカウント値を保存しながら減算する
; 5 -> 4 -> 3 -> 2 -> 1 -> 0 を出力して停止

LDA_IMM 5
STA_MEM 0x80
loop:
    LDA_MEM 0x80
    PRINTA

    CMP_A_IMM 0
    JZ end

    SUB_A_IMM 1
    STA_MEM 0x80

    CMP_A_IMM 0
    JNZ loop

end:
    HALT
```
- 即値ロード (LDA_IMM)
- メモリ読み書き (LDA_MEM / STA_MEM)
- 比較 (CMP_A_IMM)
- 減算 (SUB_A_IMM)
- 条件分岐 (JZ / JNZ)