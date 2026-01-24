/*
 * Copyright (c) 2017 Intel Corporation.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

function crc16_reflect(poly, seed, src) {
  let crc = seed;
  for (let i = 0; i < src.length; i++) {
    crc ^= src[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >>> 1) ^ poly;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return crc & 0xffff;
}
