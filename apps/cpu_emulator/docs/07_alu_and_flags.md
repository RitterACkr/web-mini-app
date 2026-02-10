# ALU and Flags (演算とフラグ)

## ALU

`ALU (Arithmetic Logic Unit)` は CPU の計算を担当する部分である

このプロジェクトで実装予定の演算
- ADD (加算)
- DEC (デクリメント)
- SUB (減算)
- CMP (比較)

---

## Flags

`Flags` は演算結果に関する状態を記録するビット

- Z (Zero flag) 結果が0なら1, それ以外は0
  - 条件分岐などの判断に使用

---

## CMP (比較) の考え方

CMP は「比較」だが, 実体は **減算して結果が0かを見る** という形で扱う

```
CMP_A_IMM imm8
r = (A - imm8) & 0xFF
Z = (r == 0)
```

---

## 実行例

### カウントダウンループ

```
A = 5 から始める

loop:
PRINTA
DEC_A
JZ end
JMP loop
end:
HALT

5 -> 4 -> 3 -> 2 -> 1 -> 0 と出力して停止する
```