// SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink All Rights Reserved.
// SPDX-License-Identifier: BSD-3-Clause

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
  },
});
