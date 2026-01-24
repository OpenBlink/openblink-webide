# M5 Stamp S3 Function Reference

## LED Control

### LED.set(color)
Sets the built-in RGB LED to the specified color.

- `color` - An array of three integers [R, G, B], each ranging from 0 to 255
- Example: `LED.set([255, 0, 0])` - Sets LED to red
- Example: `LED.set([0, 255, 0])` - Sets LED to green
- Example: `LED.set([0, 0, 255])` - Sets LED to blue
- Example: `LED.set([255, 255, 255])` - Sets LED to white
- Example: `LED.set([0, 0, 0])` - Turns LED off

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
