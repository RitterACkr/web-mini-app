# Execution Cycle (実行サイクル)

CPUは `実行サイクル` と呼ばれる処理を繰り返すことでプログラムを実行する

このサイクルは以下の3段階で構成される
1. Fetch
2. Decode
3. Execute

---

## 1. Fetch (フェッチ)

メモリから命令を読み取る

CPU は Program Counter (PC) を使って次に実行する命令の位置を知る

```
memory:
00: LDA_IMM
01: 05

Fetch:

opcode = memory[PC]

PC++
```

---

## 2. Decode (デコード)

読み取った命令が何を意味するかを判断する

```
opcode = 0x01
の場合は LDA_IMM 命令と判断する
```

---

## 3. Execute (実行)

命令に対応する処理を実行する

```
LDA_IMM 5
 ↓
A = 5
```

---

## このプロジェクト内での対応
- Fetch: CPU.fetch()
- Decode: CPU.step() 内の swtich(op)
- Execute: caseごとの処理 (LDA_IMM/ADD など)