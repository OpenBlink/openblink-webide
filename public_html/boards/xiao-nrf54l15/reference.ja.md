# XIAO nRF54L15 関数リファレンス

## 6x10 RGB MATRIX for XIAO

### PIXELS.set(index, r, g, b)

6x10 RGB マトリクスを指定した色に設定します。

- `index` - LED インデックス (0-59)
- `r` - 赤の値 (0-255)
- `g` - 緑の値 (0-255)
- `b` - 青の値 (0-255)

### PIXELS.update

設定をマトリクスに適用します。

## タイマー関数

### sleep(seconds)

指定した秒数だけプログラムの実行を一時停止します。

- `seconds` - 待機する秒数（小数も可）
- 例：`sleep 1` - 1秒待機
- 例：`sleep 0.5` - 0.5秒待機

### sleep_ms(milliseconds)

指定したミリ秒数だけプログラムの実行を一時停止します。

- `milliseconds` - 待機するミリ秒数
- 例：`sleep_ms 100` - 100ミリ秒待機
- 例：`sleep_ms 1000` - 1秒待機
