/*! @file
  @brief
  Hardware abstraction layer implementation for Emscripten/WebAssembly environment.

  <pre>
  Copyright (C) 2015- Kyushu Institute of Technology.
  Copyright (C) 2015- Shimane IT Open-Innovation Center.

  This file is distributed under BSD 3-Clause License.
  </pre>
*/

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>
#include "hal.h"

EM_JS(void, js_console_write, (const char *buf, int nbytes), {
  const text = UTF8ToString(buf, nbytes);
  if (typeof window !== 'undefined' && window.mrubycOutput) {
    window.mrubycOutput(text);
  } else {
    console.log(text);
  }
});

EM_JS(void, js_console_error, (const char *buf, int nbytes), {
  const text = UTF8ToString(buf, nbytes);
  if (typeof window !== 'undefined' && window.mrubycError) {
    window.mrubycError(text);
  } else {
    console.error(text);
  }
});

void hal_delay_ms(int ms)
{
  emscripten_sleep(ms);
}

int hal_write(int fd, const void *buf, int nbytes)
{
  if (fd == 2) {
    js_console_error((const char *)buf, nbytes);
  } else {
    js_console_write((const char *)buf, nbytes);
  }
  return nbytes;
}

int hal_flush(int fd)
{
  return 0;
}

void hal_abort(const char *s)
{
  if (s) {
    js_console_error(s, (int)strlen(s));
  }
  emscripten_force_exit(1);
}
