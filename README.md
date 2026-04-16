# OpenBlink WebIDE

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/OpenBlink/openblink-webide)

English text is followed by Chinese and Japanese translations. / 英文后面是中文和日文翻译。/ 英語の文章の後に中国語と日本語訳が続きます。

**Edit Ruby, Build & Blink, and your device changes instantly** — wireless embedded development in < 0.1 seconds, with no restart required, directly from your browser.

OpenBlink WebIDE brings [OpenBlink](https://github.com/OpenBlink/openblink)'s "**Build & Blink**" experience to your web browser. Write Ruby code, click Build & Blink, and watch it compile and transfer to your microcontroller over Bluetooth LE — all within your browser, with zero installation.

## What is OpenBlink?

[OpenBlink](https://github.com/OpenBlink/openblink) is an open-source project that enables **"Thinking Speed Prototyping"** for embedded systems.

**Key ideas:**

- **Instant rewriting** — Ruby code changes are reflected on the real device in < 0.1 sec, without microcontroller restart
- **Fully wireless** — All program transfer and debug console output run over Bluetooth LE — no cables needed
- **Ruby for embedded** — Use [mruby/c](https://github.com/mrubyc/mrubyc), a lightweight Ruby VM, to develop for microcontrollers with high productivity and readability
- **For everyone** — Not just for embedded engineers. Designed for system designers, mechanical engineers, hobbyists, students, and end users who want to customize their own devices ("DIY-able value")

## What is OpenBlink WebIDE

- Web browser-based developing environment. (Uses WebBluetooth, WebAssembly and JavaScript.)
- Provide "Thinking Speed Prototyping" not only to embedded software engineers, but to anyone who wants to try out ideas quickly, easily, and on real devices. (Without special equipment.)
- Provide "DIY-able value" where end users can run the programs they create on their own devices. (We call it "Build & Blink".)

For AI-powered comprehensive documentation that helps you understand the codebase, visit [DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide).

## Philosophy & Goals

OpenBlink is driven by the belief that **embedded programming should be accessible to everyone** — not just specialized software engineers.

### A Programmable World

Microcontroller-powered embedded devices are truly **ubiquitous** — woven into every corner of the physical world, from home appliances and wearables to industrial equipment and vehicles — and they directly influence how the real world behaves. Yet the firmware that runs on these devices has traditionally been the exclusive domain of the manufacturer; end users have had no way to modify it.

OpenBlink challenges this status quo. On an OpenBlink-enabled device, **end users themselves can rewrite part of the firmware** — safely and wirelessly — unlocking a future where everyday embedded devices become programmable. Our goal is to realize this vision of a truly _programmable world_.

And the rewrite is fast: it takes no longer than the blink of an eye — that is where the name "Blink" comes from.

### Build & Blink

_Build_ something with your own hands. _Blink_ it into reality.

Build & Blink embodies the spirit of DIY — the simple joy of creating something yourself and watching it come alive on a real device, right in front of you. You do not need to be a professional engineer or ask a manufacturer for permission. If you have an idea, you can try it now, on your own terms, with your own code.

And this is not a toy: the same Build & Blink workflow scales seamlessly into professional development. Engineers use it to tune real products, run factory tests, and iterate on production firmware — all with the same tools and the same instant feedback. OpenBlink exists to put that power in your hands, from your first experiment to your shipping product.

### Thinking Speed Prototyping

When you edit Ruby code and save, the running device reflects the change in under 0.1 seconds. The microcontroller does **not** restart: only the target task is reloaded while everything else — including the BLE connection and debug console — keeps running. This tight feedback loop lets you iterate at the speed of thought.

Conventional approaches to device customization rely on configuration parameters that the firmware developer must define in advance. This creates a dilemma: too few settings and users cannot express what they need; too many and the interface becomes overwhelming and impossible to master. Worse, no pre-designed set of options can ever anticipate every use case.

OpenBlink sidesteps this problem entirely by treating Ruby as a domain-specific language for device behavior. Instead of choosing from a fixed menu, you write code — which means you can **rewrite the logic itself**: replace a state machine, redesign a control algorithm, or completely rethink how the device responds to its inputs, all in a single save. This expressiveness is what sets OpenBlink apart from conventional parameter-tuning approaches.

**Why Ruby?** Ruby was designed from the ground up to make programmers happy — its syntax reads like natural language, and its flexible grammar (optional parentheses, blocks, keyword arguments) makes it one of the best languages for writing clean, self-documenting domain-specific code. This means even someone who has never touched embedded development can read `LED.set(part: :led1, state: true)` and understand what it does. At the same time, [mruby/c](https://github.com/mrubyc/mrubyc) — a lightweight Ruby VM built for microcontrollers — makes it possible to run Ruby on devices with as little as 15 KB of heap memory, and the mruby compiler produces compact bytecode that fits comfortably within a single BLE transfer. Ruby gives OpenBlink the rare combination of **human friendliness and microcontroller fitness**.

### Layered Task Architecture

OpenBlink firmware separates embedded software into three layers:

| Layer                                         | Language | Wirelessly rewritable? |
| --------------------------------------------- | -------- | ---------------------- |
| **Critical tasks** (drivers, BLE stack, RTOS) | C        | No                     |
| **UX tasks** (device behavior, LED patterns)  | Ruby     | Yes                    |
| **DIY tasks** (end-user programs)             | Ruby     | Yes                    |

Only the Ruby layers execute on the [mruby/c](https://github.com/mrubyc/mrubyc) VM. The C layer remains untouched during a Blink, keeping the system stable and the wireless connection alive.

### For Everyone

OpenBlink is designed so that **system designers, mechanical engineers, hobbyists, students, and end users** — not only embedded software engineers — can modify real device behavior.

**For engineers and designers:**

- Tune sensor thresholds, control sequences, and LED feedback patterns on a live product — no rebuild/flash/reboot cycle
- Write factory inspection programs that run alongside production firmware, without embedding test logic into the shipping codebase
- Let mechanical engineers adjust motor timing or haptic feedback on the actual device while it is assembled, rather than going back and forth with the software team
- Achieve **perfect sensory tuning** — in conventional development, dialing in control parameters requires long iteration cycles, but with OpenBlink the device reflects every adjustment instantly, enabling engineers to tune by feel and intuition until the result is exactly right
- Move beyond **one-size-fits-all** products — traditional mass manufacturing targets the statistical average (e.g. the 3σ range), but OpenBlink makes it practical to tailor device behavior to individual users, opening the door to truly personalized products that adapt to each person rather than forcing everyone into the same mold

**For hobbyists and students:**

- Learn embedded programming in Ruby with instant visual feedback — change a line, save, and see the LED pattern change immediately
- Experiment with I2C sensors and actuators interactively, trying different command sequences without recompiling C code
- Build and share creative projects — the wireless connection means you can program a wearable while wearing it
- **Vibe Coding on real hardware** — pair OpenBlink with an AI coding assistant and describe what you want in natural language; the AI writes the Ruby code, you save, and the device does it. The instant feedback loop lets you and the AI iterate together in real time on a physical device, not just a simulator
- **Zero installation with the WebIDE** — open [openblink.org](https://openblink.org/) in your browser and start programming immediately. No IDE setup, no SDK, no extensions — the mruby compiler runs as WebAssembly and program transfer uses WebBluetooth, so the entire toolchain is built into a single web page

**For end users ("DIY-able value"):**

- Customize the behavior of a device you own — personalize shortcuts, automate routines, or adapt the product to your specific needs
- Run your own programs on a commercially manufactured device, turning a finished product into a personal platform

Permission-level API restrictions ensure that openness and stability coexist: devices expose only the methods appropriate for each trust level, so manufacturers can safely open their products to user programming.

### From Education to Production

A single ecosystem covers **learning → hobby → production**. The same toolchain, language, and workflow apply whether you are blinking an LED for the first time or shipping a product.

### Happy Hacking

OpenBlink places great importance on the **joy of hacking on real hardware**. Every design decision serves this goal:

- **No fatal mistakes** — A buggy Ruby program cannot brick the device; the C-level firmware and BLE stack keep running, so you can always send a fix. This safety net encourages you to experiment boldly and keep trying — OpenBlink is built for people who learn by doing.
- **Instant feedback** — Changes take effect in under 0.1 seconds, keeping you in a tight edit-test loop without breaking your flow.
- **No restart** — The microcontroller stays running, which means your wireless debug console session is never interrupted.
- **Fully wireless** — Develop on a wearable while you are wearing it, or on a sensor mounted in a hard-to-reach spot — no cables to tether you.
- **Zero setup** — With OpenBlink WebIDE, there is nothing to install. Open your browser, navigate to [openblink.org](https://openblink.org/), and start hacking immediately. The mruby compiler runs as WebAssembly and program transfer uses WebBluetooth — the entire toolchain lives in a single web page.

These qualities come together to create a **happy hacking experience** for everyone who builds and blinks.

## WebSimulator (Experimental)

WebSimulator allows you to run mruby/c bytecode directly in the browser without physical hardware. This feature is experimental and available for boards that have simulator support configured. Click the "Run Simulator" button to compile and execute your code in the browser-based simulator.

## How to Use OpenBlink WebIDE (Cloud)

1. Access the WebIDE
   Open your favorite browser, such as Google Chrome or Microsoft Edge, and navigate to:
   [https://openblink.org/](https://openblink.org/)

## How to Use OpenBlink WebIDE (Local)

1. Start the Web Server

```console
$ cd public_html
public_html $ python3 -m http.server 8000
```

2. Access the WebIDE
   Open your favorite browser, such as Google Chrome or Microsoft Edge, and navigate to:
   [http://localhost:8000/](http://localhost:8000/)

## How to Build OpenBlink WebIDE

Follow the steps below to clone the repository and initialize its submodules:

1. Clone the Repository and Initialize Submodules

```console
$ git clone https://github.com/OpenBlink/openblink-webide.git
$ cd openblink-webide
$ git submodule init
$ git submodule update
```

2. Install and Activate Emscripten in the `emsdk` Directory

```console
$ cd emsdk
emsdk $ ./emsdk install 4.0.23
emsdk $ ./emsdk activate 4.0.23
emsdk $ source ./emsdk_env.sh
emsdk $ cd ..
```

3. Build mrbc and mrubyc

```console
$ make all
```

This builds both mrbc (mruby bytecode compiler) and mrubyc (mruby/c VM for WebSimulator). The build outputs are placed in `public_html/mrbc/` and `public_html/mrubyc/`.

## Documentation

- [Creating Board Configurations for WebSimulator](doc/creating-board-configurations.md)

---

# OpenBlink WebIDE

**编辑 Ruby，构建与闪烁，设备立即改变** — 无线嵌入式开发，< 0.1 秒内完成，无需重启，直接在浏览器中操作。

OpenBlink WebIDE 将 [OpenBlink](https://github.com/OpenBlink/openblink) 的“**构建与闪烁（Build & Blink）**”体验带到您的浏览器中。编写 Ruby 代码，点击 Build & Blink，即可看到代码通过 Bluetooth LE 编译并传输到您的微控制器 — 一切都在浏览器中完成，无需安装任何软件。

## 什么是 OpenBlink？

[OpenBlink](https://github.com/OpenBlink/openblink) 是一个开源项目，旨在为嵌入式系统实现“**思考速度原型设计**”。

**核心理念：**

- **即时重写** — Ruby 代码更改在 < 0.1 秒内反映到真实设备上，无需重启微控制器
- **完全无线** — 所有程序传输和调试控制台输出均通过 Bluetooth LE 运行——无需数据线
- **嵌入式 Ruby** — 使用 [mruby/c](https://github.com/mrubyc/mrubyc)（轻量级 Ruby VM）以高生产力和可读性进行微控制器开发
- **面向所有人** — 不仅面向嵌入式工程师，还面向系统设计师、机械工程师、爱好者、学生以及希望自定义设备的终端用户（“可 DIY 价值”）

## 什么是 OpenBlink WebIDE

- 基于网络浏览器的开发环境。（使用 WebBluetooth、WebAssembly 和 JavaScript。）
- 提供"思考速度原型设计"，不仅适用于嵌入式软件工程师，还适用于任何想要在真实设备上快速、轻松尝试想法的人。（无需特殊设备。）
- 提供"可 DIY 价值"，最终用户可以在自己的设备上运行他们创建的程序。（我们称之为"构建与闪烁"。）

如需查阅AI驱动的全面文档以帮助您理解代码库，请访问 [DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide)。

## 理念与目标

OpenBlink 的核心信念是：**嵌入式编程应该对每个人都是可达的** — 而不仅仅是专业软件工程师的领域。

### 可编程的世界

微控制器驱动的嵌入式设备真正**无处不在** — 它们嵌入在物理世界的每个角落，从家用电器和可穿戴设备到工业设备和车辆 — 并且直接影响着现实世界的行为。然而，运行在这些设备上的固件传统上一直是制造商的专属领域；终端用户无法修改它。

OpenBlink 挑战这一现状。在启用了 OpenBlink 的设备上，**终端用户自己就可以重写固件的一部分** — 安全且无线地 — 开启一个日常嵌入式设备变得可编程的未来。我们的目标是实现这一真正*可编程世界*的愿景。

而且重写速度非常快：不超过眨眼之间 — 这就是“Blink”名称的由来。

### 构建与闪烁（Build & Blink）

用自己的双手*构建*。将其*闪烁*为现实。

Build & Blink 体现了 DIY 精神 — 自己创造某样东西并看着它在真实设备上活起来的简单快乐。您不需要成为专业工程师，也不需要向制造商请求许可。如果您有一个想法，现在就可以用自己的代码尝试。

这不是玩具：同样的 Build & Blink 工作流可以无缝扩展到专业开发。工程师使用它来调试真实产品、运行工厂测试、迭代生产固件 — 使用相同的工具和相同的即时反馈。OpenBlink 将这种力量交到您手中，从您的第一个实验到出货产品。

### 思考速度原型设计

当您编辑 Ruby 代码并保存时，运行中的设备会在 0.1 秒内反映更改。微控制器**不会**重启：只有目标任务被重新加载，其他一切 — 包括 BLE 连接和调试控制台 — 继续运行。这种紧密的反馈循环让您以思考的速度迭代。

传统的设备自定义方法依赖于固件开发人员必须预先定义的配置参数。这会产生一个困境：设置太少，用户无法表达他们的需求；太多则界面变得复杂难以掌握。更糟糕的是，没有任何预设的选项集能够预见每一个用例。

OpenBlink 将 Ruby 作为设备行为的领域特定语言，完全绕过了这个问题。您不是从固定菜单中选择，而是编写代码 — 这意味着您可以**重写逻辑本身**：替换状态机、重新设计控制算法，或完全重新思考设备如何响应输入，所有这些只需一次保存。这种表达力是 OpenBlink 区别于传统参数调谐方法的关键。

**为什么选择 Ruby？** Ruby 从一开始就被设计为让程序员感到快乐 — 其语法读起来像自然语言，灵活的语法（可选括号、代码块、关键字参数）使其成为编写清晰、自文档化领域特定代码的最佳语言之一。这意味着即使从未接触过嵌入式开发的人也能读懂 `LED.set(part: :led1, state: true)` 并理解其含义。同时，[mruby/c](https://github.com/mrubyc/mrubyc) — 一个专为微控制器构建的轻量级 Ruby VM — 使得在仅 15 KB 堆内存的设备上运行 Ruby 成为可能，而且 mruby 编译器生成的紧凑字节码可以在一次 BLE 传输中完成。Ruby 赋予 OpenBlink **人类友好性与微控制器适配性**的罕见结合。

### 分层任务架构

OpenBlink 固件将嵌入式软件分为三层：

| 层                                     | 语言 | 可无线重写？ |
| -------------------------------------- | ---- | ------------ |
| **关键任务**（驱动、BLE 协议栈、RTOS） | C    | 否           |
| **UX 任务**（设备行为、LED 模式）      | Ruby | 是           |
| **DIY 任务**（终端用户程序）           | Ruby | 是           |

只有 Ruby 层在 [mruby/c](https://github.com/mrubyc/mrubyc) VM 上执行。C 层在 Blink 过程中保持不变，确保系统稳定和无线连接活跃。

### 面向所有人

OpenBlink 的设计使得**系统设计师、机械工程师、爱好者、学生和终端用户** — 不仅仅是嵌入式软件工程师 — 都能修改真实设备行为。

**面向工程师和设计师：**

- 在运行中的产品上调试传感器阈值、控制序列和 LED 反馈模式 — 无需重新构建/烧录/重启循环
- 编写与生产固件并行运行的工厂检查程序，无需将测试逻辑嵌入到出货代码库中
- 让机械工程师在设备组装时直接调整电机时序或触觉反馈，而不是与软件团队来回沟通
- 实现**完美的感官调校** — 在传统开发中，调试控制参数需要很长的迭代周期，但使用 OpenBlink，设备会立即反映每次调整，使工程师能够凭感觉和直觉进行调校，直到结果完全正确
- 超越**千篇一律**的产品 — 传统大规模制造针对统计平均值（例如 3σ 范围），但 OpenBlink 使得根据个人用户定制设备行为变得实际可行，为真正个性化的产品打开了大门

**面向爱好者和学生：**

- 通过即时视觉反馈学习 Ruby 嵌入式编程 — 修改一行代码，保存，立即看到 LED 模式变化
- 交互式地实验 I2C 传感器和执行器，尝试不同的命令序列而无需重新编译 C 代码
- 构建和分享创意项目 — 无线连接意味着您可以在佩戴可穿戴设备的同时对其进行编程
- **在真实硬件上进行 Vibe Coding** — 将 OpenBlink 与 AI 编程助手配对，用自然语言描述您想要的效果；AI 编写 Ruby 代码，您保存，设备就会执行。即时反馈循环让您和 AI 在物理设备上实时协作迭代，而不仅仅是在模拟器上
- **WebIDE 零安装** — 在浏览器中打开 [openblink.org](https://openblink.org/) 即可立即开始编程。无需 IDE 设置、无需 SDK、无需扩展 — mruby 编译器以 WebAssembly 运行，程序传输使用 WebBluetooth，整个工具链内置在一个网页中

**面向终端用户（“可 DIY 价值”）：**

- 自定义您拥有的设备的行为 — 个性化快捷方式、自动化日常任务，或者根据您的特定需求调整产品
- 在商业制造的设备上运行您自己的程序，将成品变成个人平台

权限级别的 API 限制确保开放性和稳定性共存：设备仅公开适合每个信任级别的方法，因此制造商可以安全地向用户开放其产品的编程功能。

### 从教育到生产

一个生态系统覆盖**学习 → 爱好 → 生产**。无论您是第一次闪烁 LED 还是出货产品，都使用相同的工具链、语言和工作流。

### 快乐黑客

OpenBlink 非常重视**在真实硬件上黑客的快乐**。每个设计决策都服务于这个目标：

- **不会犯致命错误** — 有缺陷的 Ruby 程序不会损坏设备；C 层固件和 BLE 协议栈继续运行，因此您可以随时发送修复。这个安全网鼓励您大胆实验并不断尝试 — OpenBlink 是为通过实践学习的人而构建的。
- **即时反馈** — 更改在 0.1 秒内生效，让您保持紧密的编辑-测试循环而不中断您的心流。
- **无需重启** — 微控制器持续运行，这意味着您的无线调试控制台会话永远不会中断。
- **完全无线** — 在佩戴可穿戴设备时开发它，或在难以触及的位置的传感器上开发 — 无需线缆束缚。
- **零设置** — 使用 OpenBlink WebIDE，无需安装任何软件。打开浏览器，访问 [openblink.org](https://openblink.org/)，即可立即开始黑客。mruby 编译器以 WebAssembly 运行，程序传输使用 WebBluetooth — 整个工具链都在一个网页中。

这些特质共同创造了一个让每个构建和闪烁的人都能享受的**快乐黑客体验**。

## WebSimulator（实验性功能）

WebSimulator 允许您直接在浏览器中运行 mruby/c 字节码，无需物理硬件。此功能为实验性功能，仅适用于配置了模拟器支持的开发板。点击"Run Simulator"按钮即可在浏览器模拟器中编译并执行代码。

## 如何使用 OpenBlink WebIDE（云端）

1. 访问 WebIDE
   打开您喜欢的浏览器，如 Google Chrome 或 Microsoft Edge，并导航至：
   [https://openblink.org/](https://openblink.org/)

## 如何使用 OpenBlink WebIDE（本地）

1. 启动 Web 服务器

```console
$ cd public_html
public_html $ python3 -m http.server 8000
```

2. 访问 WebIDE
   打开您喜欢的浏览器，如 Google Chrome 或 Microsoft Edge，并导航至：
   [http://localhost:8000/](http://localhost:8000/)

## 如何构建 OpenBlink WebIDE

按照以下步骤克隆存储库并初始化其子模块：

1. 克隆存储库并初始化子模块

```console
$ git clone https://github.com/OpenBlink/openblink-webide.git
$ cd openblink-webide
$ git submodule init
$ git submodule update
```

2. 在 `emsdk` 目录中安装并激活 Emscripten

```console
$ cd emsdk
emsdk $ ./emsdk install 4.0.23
emsdk $ ./emsdk activate 4.0.23
emsdk $ source ./emsdk_env.sh
emsdk $ cd ..
```

3. 构建 mrbc 和 mrubyc

```console
$ make all
```

此命令同时构建 mrbc（mruby 字节码编译器）和 mrubyc（用于 WebSimulator 的 mruby/c VM）。构建输出分别放置在 `public_html/mrbc/` 和 `public_html/mrubyc/` 目录中。

## 文档

- [为 WebSimulator 创建开发板配置](doc/creating-board-configurations.zh-CN.md)

---

# OpenBlink WebIDE

**Ruby を編集し、Build & Blink するだけで、デバイスが即座に変わる** — ワイヤレス組込み開発。0.1 秒未満で完了、再起動不要、ブラウザから直接操作。

OpenBlink WebIDE は [OpenBlink](https://github.com/OpenBlink/openblink) の「**Build & Blink**」体験を Web ブラウザに提供します。Ruby コードを書いて Build & Blink をクリックするだけで、Bluetooth LE 経由でコンパイル・転送が行われます — すべてブラウザ内で完結、インストール不要です。

## OpenBlink とは

[OpenBlink](https://github.com/OpenBlink/openblink) は、組込みシステムのための「**思考速度プロトタイピング**」を実現するオープンソースプロジェクトです。

**主なコンセプト：**

- **瞬時の書き換え** — Ruby コードの変更が 0.1 秒未満で実機に反映。マイコンの再起動不要
- **完全ワイヤレス** — プログラム転送もデバッグコンソールも全て Bluetooth LE 経由。ケーブル不要
- **組込み向け Ruby** — 軽量 Ruby VM [mruby/c](https://github.com/mrubyc/mrubyc) を使用し、高い生産性と可読性でマイコン開発
- **誰もが使える** — 組込みソフトウェアエンジニアだけでなく、システム設計者、メカ設計者、ホビイスト、学生、デバイスをカスタマイズしたいエンドユーザーのために設計（「DIY できる価値」）

## OpenBlink WebIDE とは

- Web ブラウザベースの開発環境。（WebBluetooth、WebAssembly、JavaScript を使用。）
- 「思考速度プロトタイピング」を組込みソフトウェアエンジニアだけでなく、アイデアを素早く、簡単に、実機で試したい人にも提供。（特別な機器不要。）
- エンドユーザーが自分のデバイスで作成したプログラムを実行できる「DIY 可能な価値」を提供。（私たちはこれを「Build & Blink」と呼んでいます。）

コードベースの理解を助けるAI駆動の包括的なドキュメントは、[DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide) をご覧ください。

## 理念と目標

OpenBlink は、**組込みプログラミングは誰もがアクセスできるべき** — 専門のソフトウェアエンジニアだけのものではない — という信念に基づいています。

### プログラマブルな世界

マイコン駆動の組込みデバイスはまさに**ユビキタス** — 家電やウェアラブルから産業機器や車両まで、物理世界のあらゆる場所に織り込まれ — 現実世界の振る舞いに直接影響を与えています。しかし、これらのデバイス上で動作するファームウェアは、従来製造者の専有領域であり、エンドユーザーがそれを変更する手段はありませんでした。

OpenBlink はこの現状に挑戦します。OpenBlink 対応デバイスでは、**エンドユーザー自身がファームウェアの一部を書き換えることができます** — 安全かつワイヤレスで — 日常の組込みデバイスがプログラマブルになる未来を切り拓きます。私たちの目標は、この真に*プログラマブルな世界*のビジョンを実現することです。

そして書き換えは高速です：瞬き（Blink）する間もなく完了します — これが「Blink」という名前の由来です。

### Build & Blink

自分の手で*作る*。それを現実に*閃かせる*。

Build & Blink は DIY の精神を体現しています — 自分で何かを作り、それが目の前の実機で動き出すシンプルな喜び。プロのエンジニアである必要も、製造者の許可を得る必要もありません。アイデアがあれば、今すぐ、自分のコードで試せます。

これはおもちゃではありません。同じ Build & Blink ワークフローは、プロの開発にもシームレスにスケールします。エンジニアは実製品のチューニング、工場検査、量産ファームウェアのイテレーションに同じツールと即時フィードバックを使います。OpenBlink はその力をあなたの手に委ねます — 最初の実験から出荷製品まで。

### 思考速度プロトタイピング

Ruby コードを編集して保存すると、0.1 秒未満で実行中のデバイスに反映されます。マイコンは**再起動しません**：対象タスクだけがリロードされ、BLE 接続やデバッグコンソールを含むその他全ては動作し続けます。この緊密なフィードバックループにより、思考の速度でイテレーションできます。

従来のデバイスカスタマイズは、ファームウェア開発者が事前に定義しなければならない設定パラメータに依存しています。これはジレンマを生みます：設定が少なすぎるとユーザーはニーズを表現できず、多すぎるとインターフェースが複雑になりすぎて使いこなせません。さらに、どんなに工夫された選択肢のセットでも、すべてのユースケースを予見することはできません。

OpenBlink は Ruby をデバイス動作のドメイン固有言語として扱うことで、この問題を完全に回避します。固定メニューから選ぶのではなく、コードを書く — つまり**ロジックそのものを書き換える**ことができます：ステートマシンの置き換え、制御アルゴリズムの再設計、デバイスの入力応答の完全な見直しまで、一回の保存で実現できます。この表現力が、OpenBlink を従来のパラメータ調整アプローチと区別するポイントです。

**なぜ Ruby なのか？** Ruby はプログラマーを幸せにするために設計されました — その構文は自然言語のように読め、柔軟な文法（省略可能な括弧、ブロック、キーワード引数）により、クリーンで自己文書化されたドメイン固有コードを書くのに最適な言語のひとつです。これにより、組込み開発に触れたことがない人でも `LED.set(part: :led1, state: true)` を読んで何をするか理解できます。同時に、[mruby/c](https://github.com/mrubyc/mrubyc) — マイコン向けに作られた軽量 Ruby VM — により、わずか 15 KB のヒープメモリのデバイスでも Ruby を実行でき、mruby コンパイラは一回の BLE 転送に収まるコンパクトなバイトコードを生成します。Ruby は OpenBlink に**人間の親しみやすさとマイコンへの適合性**という稀有な組み合わせをもたらします。

### レイヤードタスクアーキテクチャ

OpenBlink ファームウェアは組込みソフトウェアを三つのレイヤーに分離します：

| レイヤー                                               | 言語 | ワイヤレス書き換え可能？ |
| ------------------------------------------------------ | ---- | ------------------------ |
| **クリティカルタスク**（ドライバ、BLE スタック、RTOS） | C    | 不可                     |
| **UX タスク**（デバイス動作、LED パターン）            | Ruby | 可能                     |
| **DIY タスク**（エンドユーザープログラム）             | Ruby | 可能                     |

Ruby レイヤーのみ [mruby/c](https://github.com/mrubyc/mrubyc) VM 上で実行されます。C レイヤーは Blink 中も変更されず、システムの安定性とワイヤレス接続を維持します。

### 誰もが使える

OpenBlink は、**システム設計者、メカ設計者、ホビイスト、学生、エンドユーザー** — 組込みソフトウェアエンジニアだけでなく — が実機の動作を変更できるように設計されています。

**エンジニア・設計者向け：**

- 動作中の製品でセンサー閾値、制御シーケンス、LED フィードバックパターンをチューニング — リビルド/フラッシュ/リブートサイクル不要
- 製品ファームウェアと並行して動作する工場検査プログラムを作成 — 出荷コードベースに検査ロジックを組み込む必要なし
- メカ設計者が組み立て中の実機でモータータイミングやハプティックフィードバックを直接調整 — ソフトウェアチームとのやり取り不要
- **完璧な感性チューニング**を実現 — 従来の開発では制御パラメータの調整に長いイテレーションサイクルが必要ですが、OpenBlink ではデバイスが即座に反映し、エンジニアが感覚と直感で調整できます
- **画一的な製品**を超える — 従来の大量生産は統計的平均（例：3σ 範囲）をターゲットにしますが、OpenBlink により個々のユーザーに合わせたデバイス動作のカスタマイズが実用的になり、真にパーソナライズされた製品への道が開けます

**ホビイスト・学生向け：**

- 即時の視覚フィードバックで Ruby 組込みプログラミングを学ぶ — 一行変えて保存すれば LED パターンがすぐ変わる
- I2C センサーやアクチュエーターをインタラクティブに実験 — C コードの再コンパイルなしにコマンドシーケンスを試行錯誤
- クリエイティブなプロジェクトを作って共有 — ワイヤレス接続なのでウェアラブルを着たままプログラミング可能
- **実機で Vibe Coding** — OpenBlink と AI コーディングアシスタントを組み合わせ、自然言語でやりたいことを伝えるだけ。AI が Ruby コードを書き、保存すればデバイスが実行。即時フィードバックループで、シミュレータではなく実機上で AI とリアルタイムに協調イテレーション
- **WebIDE ならインストール不要** — ブラウザで [openblink.org](https://openblink.org/) を開けばすぐにプログラミング開始。IDE のセットアップも SDK も拡張機能も不要 — mruby コンパイラは WebAssembly で動作し、プログラム転送は WebBluetooth を使用。ツールチェーン全体が一つの Web ページに内蔵

**エンドユーザー向け（「DIY できる価値」）：**

- 所有するデバイスの動作をカスタマイズ — ショートカットのパーソナライズ、ルーティンの自動化、考えの特定のニーズに合わせた製品調整
- 商業製造されたデバイス上で自分のプログラムを実行 — 完成品を個人プラットフォームに変える

許可レベルに応じた API 制限により、オープン性と安定性を両立：デバイスは各信頼レベルに適切なメソッドのみを公開するため、製造者は安全に製品をユーザープログラミングに開放できます。

### 教育からプロダクションまで

単一のエコシステムが**学習 → ホビー → プロダクション**をカバー。初めて LED を光らせるときも、製品を出荷するときも、同じツールチェーン・言語・ワークフローを使用します。

### Happy Hacking

OpenBlink は**実機ハッキングの喜び**を非常に重視しています。すべての設計判断がこの目標に向かっています：

- **致命的なミスなし** — バグのある Ruby プログラムでデバイスが壊れることはありません。C 層のファームウェアと BLE スタックは動作し続けるので、いつでも修正を送れます。このセーフティネットが大胆な実験と繰り返しの挑戦を促します — OpenBlink は「やってみて学ぶ」人のために作られています。
- **即時フィードバック** — 変更は 0.1 秒未満で反映。編集・テストの緊密なループを維持し、フローを切らしません。
- **再起動不要** — マイコンは動作し続けるため、ワイヤレスデバッグコンソールのセッションが中断されることはありません。
- **完全ワイヤレス** — ウェアラブルを着たまま開発、手の届きにくい場所のセンサーも開発可能 — ケーブルに縛られません。
- **ゼロセットアップ** — OpenBlink WebIDE ならインストール不要。ブラウザを開いて [openblink.org](https://openblink.org/) にアクセスすれば、すぐにハッキング開始。mruby コンパイラは WebAssembly で動作、プログラム転送は WebBluetooth — ツールチェーン全体が一つの Web ページに収まっています。

これらの特性が組み合わさり、すべての Build & Blink ユーザーに**楽しいハッキング体験**を創り出します。

## WebSimulator（実験的機能）

WebSimulator を使用すると、物理ハードウェアなしでブラウザ上で直接 mruby/c バイトコードを実行できます。この機能は実験的であり、シミュレータサポートが設定されているボードでのみ利用可能です。「Run Simulator」ボタンをクリックすると、ブラウザベースのシミュレータでコードをコンパイルして実行できます。

## OpenBlink WebIDE（クラウド）の使い方

1. WebIDE にアクセス
   Google Chrome や Microsoft Edge などお好みのブラウザを開き、以下の URL にアクセスしてください：
   [https://openblink.org/](https://openblink.org/)

## OpenBlink WebIDE（ローカル）の使い方

1. Web サーバーを起動

```console
$ cd public_html
public_html $ python3 -m http.server 8000
```

2. WebIDE にアクセス
   Google Chrome や Microsoft Edge などお好みのブラウザを開き、以下の URL にアクセスしてください：
   [http://localhost:8000/](http://localhost:8000/)

## OpenBlink WebIDE のビルド方法

以下の手順でリポジトリをクローンし、サブモジュールを初期化してください：

1. リポジトリのクローンとサブモジュールの初期化

```console
$ git clone https://github.com/OpenBlink/openblink-webide.git
$ cd openblink-webide
$ git submodule init
$ git submodule update
```

2. `emsdk` ディレクトリで Emscripten をインストールして有効化

```console
$ cd emsdk
emsdk $ ./emsdk install 4.0.23
emsdk $ ./emsdk activate 4.0.23
emsdk $ source ./emsdk_env.sh
emsdk $ cd ..
```

3. mrbc と mrubyc をビルド

```console
$ make all
```

このコマンドで mrbc（mruby バイトコードコンパイラ）と mrubyc（WebSimulator 用 mruby/c VM）の両方がビルドされます。ビルド出力は `public_html/mrbc/` と `public_html/mrubyc/` に配置されます。

## ドキュメント

- [WebSimulator 用ボード設定の作成](doc/creating-board-configurations.ja.md)
