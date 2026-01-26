# M5 Stamp S3 函数参考

## LED 控制

### LED.set(color)
设置内置 RGB LED 的颜色。

- `color` - 包含三个整数的数组 [R, G, B]，每个值范围为 0 到 255
- 示例：`LED.set([255, 0, 0])` - 设置 LED 为红色
- 示例：`LED.set([0, 255, 0])` - 设置 LED 为绿色
- 示例：`LED.set([0, 0, 255])` - 设置 LED 为蓝色
- 示例：`LED.set([255, 255, 255])` - 设置 LED 为白色
- 示例：`LED.set([0, 0, 0])` - 关闭 LED

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
