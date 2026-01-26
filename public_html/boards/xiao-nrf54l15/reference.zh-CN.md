# XIAO nRF54L15 函数参考

## 6x10 RGB MATRIX for XIAO

### PIXELS.set(index, r, g, b)

设置 6x10 RGB 矩阵的指定颜色。

- `index` - LED 索引 (0-59)
- `r` - 红色值 (0-255)
- `g` - 绿色值 (0-255)
- `b` - 蓝色值 (0-255)

### PIXELS.update

将设置应用到矩阵。

## 定时器函数

### sleep(seconds)

暂停程序执行指定的秒数。

- `seconds` - 等待的秒数（可以是小数）
- 示例：`sleep 1` - 等待 1 秒
- 示例：`sleep 0.5` - 等待 0.5 秒

### sleep_ms(milliseconds)

暂停程序执行指定的毫秒数。

- `milliseconds` - 等待的毫秒数
- 示例：`sleep_ms 100` - 等待 100 毫秒
- 示例：`sleep_ms 1000` - 等待 1 秒
