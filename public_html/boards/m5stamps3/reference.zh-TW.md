# M5 Stamp S3 函式參考

## LED 控制

### LED.set(color)
設定內建 RGB LED 的顏色。

- `color` - 包含三個整數的陣列 [R, G, B]，每個值範圍為 0 到 255
- 範例：`LED.set([255, 0, 0])` - 設定 LED 為紅色
- 範例：`LED.set([0, 255, 0])` - 設定 LED 為綠色
- 範例：`LED.set([0, 0, 255])` - 設定 LED 為藍色
- 範例：`LED.set([255, 255, 255])` - 設定 LED 為白色
- 範例：`LED.set([0, 0, 0])` - 關閉 LED

## 計時器函式

### sleep(seconds)
暫停程式執行指定的秒數。

- `seconds` - 等待的秒數（可以是小數）
- 範例：`sleep 1` - 等待 1 秒
- 範例：`sleep 0.5` - 等待 0.5 秒

### sleep_ms(milliseconds)
暫停程式執行指定的毫秒數。

- `milliseconds` - 等待的毫秒數
- 範例：`sleep_ms 100` - 等待 100 毫秒
- 範例：`sleep_ms 1000` - 等待 1 秒
