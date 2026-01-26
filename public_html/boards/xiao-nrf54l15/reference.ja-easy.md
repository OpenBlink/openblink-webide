# 🌟 XIAO nRF54L15 つかいかた

## 🌈 6x10 RGB MATRIX for XIAO

### PIXELS.set(index, r, g, b)

6x10の ひかる マトリクスの いろを かえます。

- `index` - LEDの ばんごう (0から59まで)
- `r` - あかの つよさ (0から255まで)
- `g` - みどりの つよさ (0から255まで)
- `b` - あおの つよさ (0から255まで)

### PIXELS.update

いろの せっていを マトリクスに おくります。

## ⏱️ タイマー

### sleep(seconds)

プログラムを すこし とめます。

- `seconds` - まつ びょうすう（0.5 みたいな すうじも つかえます）
- れい：`sleep 1` - 1びょう まつ
- れい：`sleep 0.5` - 0.5びょう まつ

### sleep_ms(milliseconds)

プログラムを すこし とめます（ミリびょうで きめます）。

- `milliseconds` - まつ ミリびょうすう
- れい：`sleep_ms 100` - 100ミリびょう まつ
- れい：`sleep_ms 1000` - 1びょう まつ
