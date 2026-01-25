/*! @file
  @brief
  Hardware abstraction layer for Emscripten/WebAssembly environment.

  <pre>
  Copyright (C) 2015- Kyushu Institute of Technology.
  Copyright (C) 2015- Shimane IT Open-Innovation Center.

  This file is distributed under BSD 3-Clause License.
  </pre>
*/

#ifndef MRBC_SRC_HAL_H_
#define MRBC_SRC_HAL_H_

#ifdef __cplusplus
extern "C" {
#endif

#define MRBC_TICK_UNIT 1
#define MRBC_TIMESLICE_TICK_COUNT 10

void mrbc_tick(void);

#define hal_init()        ((void)0)
#define hal_enable_irq()  ((void)0)
#define hal_disable_irq() ((void)0)

void hal_delay_ms(int ms);
#define hal_idle_cpu()    (hal_delay_ms(MRBC_TICK_UNIT), mrbc_tick())

int hal_write(int fd, const void *buf, int nbytes);
int hal_flush(int fd);
void hal_abort(const char *s);

#ifdef __cplusplus
}
#endif

#endif
