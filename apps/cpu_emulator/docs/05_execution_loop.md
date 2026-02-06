# Execution Loop (実行ループ)

CPUは

1. Fetch (命令を読む)
2. Decode (命令を判別する)
3. Execute (命令を実行する)

を HALT (停止命令) が来るまで繰り返す

---

このプロジェクトでは `step()`が 1命令分を実行する

1. opcode を fetch
2. opcode で分岐 (decode)
3. 必要なら operand を fetch
4. 命令を実行 (execute)