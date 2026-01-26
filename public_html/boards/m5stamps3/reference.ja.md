# M5 Stamp S3 関数リファレンス

## LED 制御

### LED.set(color)
内蔵 RGB LED を指定した色に設定します。

- `color` - 3つの整数を含む配列 [R, G, B]、各値は 0 から 255
- 例：`LED.set([255, 0, 0])` - LED を赤色に設定
- 例：`LED.set([0, 255, 0])` - LED を緑色に設定
- 例：`LED.set([0, 0, 255])` - LED を青色に設定
- 例：`LED.set([255, 255, 255])` - LED を白色に設定
- 例：`LED.set([0, 0, 0])` - LED を消灯

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
