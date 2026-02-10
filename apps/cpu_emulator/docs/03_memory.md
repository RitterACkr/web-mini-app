# Memory (メモリ)

`メモリ` は CPU が読み書き可能な大容量の記憶領域

- 命令 (opcode)
- 命令の引数 (immediate / address)
- データ (値)

---

## メモリの役割

CPUのレジスタは高速だが数が少ない

⇒ メモリは外部の大容量の記憶領域

---

## ROM と RAM

- ROM (Read Only Memory)
  - プログラムが入っている領域 (読み取り専用)
- RAM (Random Access Memory)
  - 実行中に読み書き可能な領域 (一時的なデータ置き場)

---

## Stack と SP

`スタック` は一時的なデータ保存やサブルーチン (CALL / RET) の戻り先の管理に使われる

この CPU ではメモリの一部を **スタック (Stack)** として使用する

### SP (Stack Pointer)
- 「スタックの先頭位置」を指すレジスタ
- この CPU ではスタックは上位アドレスから下方向へ伸びる

```
高アドレス
0xFF <- 初期SP
0xFE
0xFD
低アドレス
```

### 基本操作
```
PUSH:
  mem[SP] = value
  SP = SP - 1

POP:
  SP = SP + 1
  value = mem[SP]
```