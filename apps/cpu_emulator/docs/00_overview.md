# CPU Emulator - Overview

## 概要

CPUの基本構造を理解
JS による最小CPUエミュレータの実装

## CPUの構成
- レジスタ (内部変数)
- プログラムカウンタ (pc)
- 命令デコーダ
- 演算装置 (ALU)

## 実装

### レジスタ
- A
- B
- PC
- Z (Zero flag)

### メモリ
- ROM (Program)

### 命令
- LDA_IMM
- LDB_IMM
- ADD
- PRINTA
- JMP
- JZ
- HALT

### 実行
1. PCの位置から命令を読む
2. PCを進める
3. 命令を実行
4. HALTまで繰り返す