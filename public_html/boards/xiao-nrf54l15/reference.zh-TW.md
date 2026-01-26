# XIAO nRF54L15 函式參考

## 6x10 RGB MATRIX for XIAO

### PIXELS.set(index, r, g, b)

設定 6x10 RGB 矩陣的指定顏色。

- `index` - LED 索引 (0-59)
- `r` - 紅色值 (0-255)
- `g` - 綠色值 (0-255)
- `b` - 藍色值 (0-255)

### PIXELS.update

將設定套用到矩陣。

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
