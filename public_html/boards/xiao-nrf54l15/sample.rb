printf "#{RUBY_ENGINE} #{MRUBYC_VERSION} (mruby:#{MRUBY_VERSION} ruby:#{RUBY_VERSION})\n"

WIDTH = 10
HEIGHT = 6
LED_COUNT = WIDTH * HEIGHT
MAX_BRIGHTNESS = 20

CENTER_X = 4.5
CENTER_Y = 2.5
RADIUS = 3.5

def hsv_to_rgb(h, s, v)
  c = v * s
  
  h_sector = h / 60.0
  sector_index = h_sector.to_i % 6
  sector_fraction = h_sector - h_sector.to_i

  if sector_index % 2 == 0
    x = c * sector_fraction
  else
    x = c * (1 - sector_fraction)
  end

  m = v - c

  case sector_index
  when 0
    r, g, b = c, x, 0
  when 1
    r, g, b = x, c, 0
  when 2
    r, g, b = 0, c, x
  when 3
    r, g, b = 0, x, c
  when 4
    r, g, b = x, 0, c
  else # 5
    r, g, b = c, 0, x
  end

  [(r + m).to_i, (g + m).to_i, (b + m).to_i]
end

tick = 0

while true
  if Input.pressed?(part: :sw1)
    puts ("SW1 pressed")
  end

  10.times do |x|
    6.times do |y|
      
      col_from_right = 9 - x
      index = (col_from_right * 6) + y

      dx = x - CENTER_X
      dy = y - CENTER_Y
      distance = Math.sqrt(dx * dx + dy * dy)

      if distance <= RADIUS
        angle = Math.atan2(dy, dx)
        degree = angle * 180.0 / Math::PI
        
        hue = (degree + tick).to_i % 360
        hue += 360 if hue < 0

        r, g, b = hsv_to_rgb(hue, 1.0, MAX_BRIGHTNESS)
        PIXELS.set(index, r, g, b)
      else
        PIXELS.set(index, 0, 0, 0)
      end
    end
  end

  PIXELS.update
  
  tick += 15
  sleep_ms 30
end
