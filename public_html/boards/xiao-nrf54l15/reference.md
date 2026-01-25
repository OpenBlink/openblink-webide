# XIAO nRF54L15 Function Reference

## Switch Control

### Input.pressed?(part: :sw1)

Returns whether the button is pressed.

### Input.released?(part: :sw1)

Returns whether the button is released.

## 6x10 RGB MATRIX for XIAO

### PIXELS.set(index, r, g, b)

Sets the 6x10 RGB MATRIX to the specified color.

- `index` - LED index (0-59)
- `r` - Red value (0-255)
- `g` - Green value (0-255)
- `b` - Blue value (0-255)

### PIXELS.update

Applies the settings to the matrix.

## LED Control

### LED.set(part: :led1, state: true)

Turns ON the LED.

### LED.set(part: :led1, state: false)

Turns OFF the LED.

## Timer Functions

### sleep(seconds)

Pauses program execution for the specified number of seconds.

- `seconds` - Number of seconds to wait (can be a decimal)
- Example: `sleep 1` - Wait for 1 second
- Example: `sleep 0.5` - Wait for 0.5 seconds

### sleep_ms(milliseconds)

Pauses program execution for the specified number of milliseconds.

- `milliseconds` - Number of milliseconds to wait
- Example: `sleep_ms 100` - Wait for 100 milliseconds
- Example: `sleep_ms 1000` - Wait for 1 second
