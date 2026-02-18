# Assembler (アセンブラ)

`Assembler` は人間が読み書きしやすい命令 (アセンブリ) をCPUが実行できるバイト列 (機械語) に変換する

```
LDA_IMM 5
PRINTA
HALT

↓

01 05 04 FF
```

## このプロジェクトでのアセンブラの実装方針

- 1行 = 1命令
- `;` 以降はコメントとして無視
- ラベルは `label:` 形式
- 数値は 10進数 または 16進数(0x..)
- 出力は Unit8Array (バイト列)

最初は最小限での実装を予定

---

## 変換処理

1. 各行の命令サイズを数えてラベルのアドレスを確定
2. 実際にバイト列を生成

---

## 疑似命令 (Pseudo Instruction)

疑似命令はCPUが実行する命令ではなく,アセンブラが処理する特別な指示

### .equ (定数定義)

定数に名前を付けることができる
```
NAME .equ VALUE
```

- 可読性の工場
- メンテナンス性の向上

**書式:**
- NAME: 英字またはアンダースコアで始まる識別子
- VALUE: 10進数または16進数(0x...)

**例:**
```asm
COUNTER .equ 0x80
RESULT .equ 0x81

LDA_IMM 5
STA_MEM COUNTER
LAD_MEM COUNTER
STA_MEM RESULT
```