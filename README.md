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

**编辑 Ruby，Build & Blink，设备立即改变** — 无线嵌入式开发，不到 0.1 秒完成，无需重启，直接在浏览器中操作。

OpenBlink WebIDE 将 [OpenBlink](https://github.com/OpenBlink/openblink) 的"**Build & Blink**"体验带到您的 Web 浏览器中。编写 Ruby 代码，点击 Build & Blink，即可看到代码通过 Bluetooth LE 编译并传输到您的微控制器 — 一切都在浏览器中完成，无需安装任何软件。

## OpenBlink 是什么

[OpenBlink](https://github.com/OpenBlink/openblink) 是一个开源项目，为嵌入式系统实现"**思维速度的原型开发**"。

**核心理念：**

- **即时重写** — Ruby 代码的更改在不到 0.1 秒内反映到实际设备上，无需微控制器重启
- **完全无线** — 所有程序传输和调试控制台输出均通过蓝牙低功耗运行，无需线缆
- **嵌入式中的 Ruby** — 使用面向微控制器的轻量级 Ruby VM [mruby/c](https://github.com/mrubyc/mrubyc)，以高生产力和高可读性进行开发
- **面向所有人** — 不仅面向嵌入式工程师，还面向系统设计师、机械工程师、爱好者、学生以及希望定制自己设备的终端用户（"可 DIY 的价值"）

## 什么是 OpenBlink WebIDE

- 基于 Web 浏览器的开发环境。（使用 WebBluetooth、WebAssembly 和 JavaScript。）
- 提供"思维速度的原型开发"，不仅面向嵌入式软件工程师，也面向任何想要在真实设备上快速、轻松尝试想法的人。（无需特殊设备。）
- 提供"可 DIY 的价值"，终端用户可以在自己的设备上运行他们创建的程序。（我们称之为"Build & Blink"。）

如需查阅有助于理解代码库的 AI 驱动的全面文档，请访问 [DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide)。

## 理念与目标

OpenBlink 坚信**嵌入式编程应当面向所有人开放**，而不仅仅是专业软件工程师的专属领域。

### 可编程的世界

搭载微控制器的嵌入式设备真正**无处不在**——从家用电器、可穿戴设备到工业设备和车辆，它们遍布物理世界的每一个角落，直接影响着现实世界的运行方式。然而，运行在这些设备上的固件传统上一直是制造商的专属领域；终端用户没有任何方式对其进行修改。

OpenBlink 挑战这一现状。在启用 OpenBlink 的设备上，**终端用户自己可以安全、无线地重写固件的一部分**，开启日常嵌入式设备变得可编程的未来。我们的目标是实现这一真正*可编程世界*的愿景。

而且重写速度极快：不超过眨眼的时间——这就是 "Blink" 名称的由来。

### Build & Blink

用自己的双手 _Build（构建）_ 某样东西。将它 _Blink（瞬间闪现）_ 为现实。

Build & Blink 体现了 DIY 的精神——自己动手创造，然后看着它在眼前的真实设备上活起来，这种简单的喜悦。你不需要是专业工程师，也不需要征得制造商的许可。如果你有想法，现在就可以用自己的代码、按自己的方式去尝试。

而且这不是玩具：同样的 Build & Blink 工作流可以无缝扩展到专业开发中。工程师用它来调优实际产品、运行出厂检测、迭代量产固件——使用完全相同的工具和即时反馈。OpenBlink 的存在，就是为了将这种能力交到你的手中，从你的第一次实验到产品出货。

### 思维速度的原型开发

当你编辑 Ruby 代码并保存时，正在运行的设备会在 0.1 秒内反映更改。微控制器**不会**重启：只有目标任务被重新加载，其他一切——包括 BLE 连接和调试控制台——继续运行。这种紧密的反馈循环让你能够以思维的速度进行迭代。

传统的设备定制方法依赖于固件开发者必须预先定义的配置参数。这产生了一个两难困境：设置项太少，用户无法表达自己的需求；太多，界面就变得令人不知所措且无法掌握。更糟的是，无论怎样精心设计的选项组合都无法预见所有用例。

OpenBlink 通过将 Ruby 作为设备行为的领域专用语言，从根本上绕过了这一问题。你不是从固定菜单中选择，而是编写代码——这意味着你可以**重写逻辑本身**：替换状态机、重新设计控制算法、或者彻底改变设备对输入的响应方式，一次保存即可完成。这种表达力正是 OpenBlink 区别于传统参数调优方法的关键所在。

**为什么选择 Ruby？** Ruby 从一开始就是为了让程序员感到快乐而设计的——它的语法读起来像自然语言，灵活的文法（可选括号、块、关键字参数）使其成为编写简洁、自文档化领域专用代码的最佳语言之一。这意味着即使从未接触过嵌入式开发的人也能读懂 `LED.set(part: :led1, state: true)` 并理解它的作用。同时，[mruby/c](https://github.com/mrubyc/mrubyc)——专为微控制器构建的轻量级 Ruby VM——使得在仅有 15 KB 堆内存的设备上运行 Ruby 成为可能，而 mruby 编译器生成的紧凑字节码完全可以在单次 BLE 传输中完成。Ruby 赋予 OpenBlink **对人类的友好性与对微控制器的适配性**这一罕见的组合。

### 分层任务架构

OpenBlink 固件将嵌入式软件分为三层：

| 层                                         | 语言 | 可无线重写？ |
| ------------------------------------------ | ---- | ------------ |
| **关键任务**（驱动程序、BLE 协议栈、RTOS） | C    | 否           |
| **UX 任务**（设备行为、LED 模式）          | Ruby | 是           |
| **DIY 任务**（终端用户程序）               | Ruby | 是           |

只有 Ruby 层在 [mruby/c](https://github.com/mrubyc/mrubyc) VM 上执行。C 层在 Blink 过程中保持不变，确保系统稳定性和无线连接不受影响。

### 面向所有人

OpenBlink 的设计使得不仅是嵌入式软件工程师，**系统设计师、机械工程师、爱好者、学生和终端用户**都能修改真实设备的行为。

**面向工程师和设计师：**

- 在运行中的产品上调优传感器阈值、控制序列和 LED 反馈模式——无需重新构建/烧录/重启
- 编写与量产固件并行运行的出厂检测程序，无需在出货代码库中嵌入测试逻辑
- 让机械工程师在实际组装状态的设备上直接调整电机时序或触觉反馈，无需与软件团队反复沟通
- 实现**完美的感官调优**——在传统开发中，调整控制参数需要漫长的迭代周期，但使用 OpenBlink 后设备会即时反映每一次调整，工程师可以凭感觉和直觉进行调优，直到结果恰到好处
- 超越**千人一面的产品**——传统量产以统计平均值（如 3σ 范围）为目标，但 OpenBlink 使得根据个体用户定制设备行为变得切实可行，为真正个性化的产品打开了大门，让产品适应每个人，而非强迫所有人接受同一个模式

**面向爱好者和学生：**

- 用 Ruby 学习嵌入式编程，即时获得视觉反馈——修改一行代码，保存，立即看到 LED 模式的变化
- 以交互方式试验 I2C 传感器和执行器，无需重新编译 C 代码即可尝试不同的命令序列
- 构建并分享创意项目——无线连接意味着你可以在穿戴设备的同时对其编程
- **在真实硬件上进行 Vibe Coding** — 将 OpenBlink 与 AI 编程助手搭配使用，用自然语言描述你想要的效果；AI 编写 Ruby 代码，你保存，设备就会执行。即时反馈循环让你和 AI 能够在物理设备上实时协作迭代，而非仅在模拟器中
- **WebIDE 零安装** — 在浏览器中打开 [openblink.org](https://openblink.org/) 即可立即开始编程。无需 IDE 设置、SDK 或扩展 — mruby 编译器以 WebAssembly 运行，程序传输使用 WebBluetooth，整个工具链都内置在一个网页中

**面向终端用户（"可 DIY 的价值"）：**

- 定制你拥有的设备的行为——个性化快捷方式、自动化日常操作，或根据你的特定需求调整产品
- 在商业制造的设备上运行你自己的程序，将成品变成你的个人平台

权限级别的 API 限制确保了开放性与稳定性的共存：设备仅暴露与每个信任级别相适应的方法，因此制造商可以安心地将其产品向用户编程开放。

### 从教育到生产

一个生态系统覆盖**学习 → 爱好 → 生产**的全过程。无论你是第一次让 LED 闪烁，还是交付产品，使用的都是相同的工具链、相同的语言和相同的工作流。

### Happy Hacking

OpenBlink 非常重视**在真实硬件上进行黑客创造的乐趣**。每一个设计决策都服务于这一目标：

- **不会犯致命错误** — 有 bug 的 Ruby 程序不会使设备变砖；C 层固件和 BLE 协议栈持续运行，因此你随时可以发送修复。这一安全网鼓励你大胆实验、不断尝试——OpenBlink 是为在实践中学习的人而打造的。
- **即时反馈** — 更改在 0.1 秒内生效，让你保持在紧密的编辑-测试循环中，不打断心流。
- **无需重启** — 微控制器持续运行，这意味着你的无线调试控制台会话永远不会被中断。
- **完全无线** — 在穿戴设备的同时进行开发，或对安装在难以触及位置的传感器编程——没有线缆的束缚。
- **零设置** — 使用 OpenBlink WebIDE 无需安装任何软件。打开浏览器访问 [openblink.org](https://openblink.org/) 即可立即开始黑客创造。mruby 编译器以 WebAssembly 运行，程序传输使用 WebBluetooth — 整个工具链都在一个网页中。

这些特质共同为每一位 Build & Blink 的人创造了**快乐的黑客体验**。

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

**Ruby を編集し、Build & Blink するだけで、デバイスが即座に変わる** — ワイヤレス組み込み開発。0.1 秒未満で完了、再起動不要、ブラウザから直接操作。

OpenBlink WebIDE は [OpenBlink](https://github.com/OpenBlink/openblink) の「**Build & Blink**」体験を Web ブラウザに提供します。Ruby コードを書いて Build & Blink をクリックするだけで、Bluetooth LE 経由でコンパイル・転送が行われます — すべてブラウザ内で完結、インストール不要です。

## OpenBlink とは

[OpenBlink](https://github.com/OpenBlink/openblink) は、組み込みシステムのための「**思考速度のプロトタイピング**」を実現するオープンソースプロジェクトです。

**主なコンセプト：**

- **瞬時の書き換え** — Ruby コードの変更が 0.1 秒未満で実機に反映され、マイコンの再起動を伴いません
- **完全ワイヤレス** — プログラム転送もデバッグコンソールもすべて Bluetooth LE 経由で動作し、ケーブルは不要です
- **組み込みに Ruby を** — マイコン向け軽量 Ruby VM である [mruby/c](https://github.com/mrubyc/mrubyc) を使い、高い生産性と可読性で開発できます
- **すべての人に** — 組み込みソフトウェアエンジニアだけでなく、システム設計者・メカ設計者・ホビイスト・学生・エンドユーザーが自分のデバイスをカスタマイズできる「DIY できる価値」を提供します

## OpenBlink WebIDE とは

- Web ブラウザベースの開発環境。（WebBluetooth、WebAssembly、JavaScript を使用。）
- 「思考速度のプロトタイピング」を組み込みソフトウェアエンジニアだけでなく、アイデアを素早く、簡単に、実機で試したい人にも提供。（特別な機器不要。）
- エンドユーザーが自分のデバイスで作成したプログラムを実行できる「DIY できる価値」を提供。（私たちはこれを「Build & Blink」と呼んでいます。）

コードベースの理解を助ける AI 駆動の包括的なドキュメントは、[DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide) をご覧ください。

## 思想とゴール

OpenBlink は、**組み込みプログラミングはすべての人に開かれるべきである**という信念に基づいています。専門のソフトウェアエンジニアだけのものではありません。

### プログラマブルな世界

マイコンを搭載した組み込みデバイスは、家電やウェアラブル機器から産業機器・車両に至るまで、物理世界のあらゆる場所に**遍在**しており、現実世界の振る舞いに直接影響を与えています。しかし、これらのデバイス上で動作するファームウェアは従来メーカーの専有領域であり、エンドユーザーがそれを変更する手段はありませんでした。

OpenBlink はこの現状に挑みます。OpenBlink 対応デバイスでは、**エンドユーザー自身がファームウェアの一部を安全かつワイヤレスに書き換えることができ**、日常の組み込みデバイスがプログラマブルになる未来を切り拓きます。私たちの目標は、この真に*プログラマブルな世界*のビジョンを実現することです。

そして書き換えは高速です。瞬きするほどの時間しかかかりません — これが "Blink" という名前の由来です。

### Build & Blink

自分の手で何かを _Build（つくる）_。それを _Blink（瞬時に現実にする）_。

Build & Blink は DIY の精神を体現しています — 自分で何かをつくり、それが目の前の実機で動き出す、そのシンプルな喜びです。プロのエンジニアである必要も、メーカーに許可を求める必要もありません。アイデアがあれば、自分のコードで、自分のやり方で、今すぐ試せます。

そしてこれはおもちゃではありません。同じ Build & Blink のワークフローがプロフェッショナルな開発にもそのままスケールします。エンジニアはこれを使って実製品のチューニング、出荷検査、量産ファームウェアの反復改善を行います — すべて同じツールで、同じ即時フィードバックで。OpenBlink は、最初の実験から出荷製品まで、その力をあなたの手に届けるために存在します。

### 思考速度のプロトタイピング

Ruby コードを編集して保存すると、動作中のデバイスに 0.1 秒以内で変更が反映されます。マイコンは**再起動しません**。対象タスクだけがリロードされ、BLE 接続やデバッグコンソールを含む他のすべてはそのまま動作し続けます。この緊密なフィードバックループにより、思考速度でイテレーションできます。

従来のデバイスカスタマイズ手法は、ファームウェア開発者が事前に定義した設定パラメータに依存しています。これにはジレンマがあります：設定項目が少なすぎるとユーザーのニーズを表現できず、多すぎるとインターフェースが複雑になり使いこなせません。さらに悪いことに、どんなに周到に設計されたオプションの組み合わせでも、すべてのユースケースを予測することはできません。

OpenBlink は、Ruby をデバイス動作のためのドメイン固有言語として扱うことで、この問題を根本的に回避します。固定メニューから選ぶのではなく、コードを書きます — つまり**ロジックそのものを書き換える**ことができます：ステートマシンの置き換え、制御アルゴリズムの再設計、デバイスの入力への応答方法の完全な見直し、すべてが一回の保存で可能です。この表現力こそが、OpenBlink を従来のパラメータ調整アプローチとは一線を画すものにしています。

**なぜ Ruby なのか？** Ruby はプログラマを幸せにするためにゼロから設計されました — その構文は自然言語のように読め、柔軟な文法（省略可能な括弧、ブロック、キーワード引数）により、クリーンで自己文書化されたドメイン固有コードを書くのに最適な言語のひとつです。つまり、組み込み開発に触れたことがない人でも `LED.set(part: :led1, state: true)` を読めば何をしているか理解できます。同時に、[mruby/c](https://github.com/mrubyc/mrubyc) — マイコン向けに設計された軽量 Ruby VM — により、わずか 15 KB のヒープメモリしかないデバイス上でも Ruby を実行でき、mruby コンパイラが生成するコンパクトなバイトコードは BLE の1回の転送に収まります。Ruby は OpenBlink に**人間にとっての親しみやすさとマイコンへの適合性**という稀有な組み合わせをもたらしています。

### 階層型タスクアーキテクチャ

OpenBlink のファームウェアは、組み込みソフトウェアを3つの層に分離します：

| 層                                                     | 言語 | ワイヤレス書き換え |
| ------------------------------------------------------ | ---- | ------------------ |
| **クリティカルタスク**（ドライバ、BLE スタック、RTOS） | C    | 不可               |
| **UX タスク**（デバイスの振る舞い、LED パターン）      | Ruby | 可能               |
| **DIY タスク**（エンドユーザープログラム）             | Ruby | 可能               |

Ruby 層のみが [mruby/c](https://github.com/mrubyc/mrubyc) VM 上で実行されます。C 層は Blink 中も変更されないため、システムの安定性とワイヤレス接続が維持されます。

### すべての人に

OpenBlink は、組み込みソフトウェアエンジニアだけでなく、**システム設計者、メカ設計者、ホビイスト、学生、エンドユーザー**が実デバイスの振る舞いを変更できるように設計されています。

**エンジニア・設計者向け：**

- センサ閾値、制御シーケンス、LED フィードバックパターンを稼働中の製品上でチューニング — リビルド／フラッシュ書き込み／リブートのサイクル不要
- 出荷検査プログラムを量産ファームウェアと並行して実行でき、出荷コードベースに検査ロジックを組み込む必要がない
- メカ設計者がアセンブリ状態の実機上でモータタイミングやハプティクスフィードバックを直接調整でき、ソフトウェアチームとの往復が不要に
- **完璧な感性チューニング**の実現 — 従来の開発では制御パラメータの追い込みに長いイテレーションサイクルが必要でしたが、OpenBlink ではデバイスがあらゆる調整を即座に反映するため、エンジニアは感覚と直感でチューニングし、結果が完璧になるまで追い込むことができます
- **画一的な製品からの脱却** — 従来の量産は統計的平均（例：3σ 範囲）をターゲットにしていますが、OpenBlink によりデバイスの振る舞いを個々のユーザーに合わせることが現実的になり、全員を同じ型にはめるのではなく一人ひとりに寄り添う、真にパーソナライズされた製品への道が開かれます

**ホビイスト・学生向け：**

- Ruby で組み込みプログラミングを即座に視覚的フィードバックとともに学べる — 1行変更して保存すれば、LED パターンがすぐに変わる
- I2C センサやアクチュエータをインタラクティブに試せる — C コードの再コンパイルなしにコマンドシーケンスを変えながら実験できる
- クリエイティブなプロジェクトを作って共有できる — ワイヤレス接続なので、ウェアラブルを装着したままプログラミングできる
- **実機でバイブコーディング** — OpenBlink と AI コーディングアシスタントを組み合わせ、自然言語でやりたいことを伝えると、AI が Ruby コードを書き、保存すればデバイスが動作します。即時フィードバックループにより、シミュレータではなく物理デバイス上で AI とリアルタイムにイテレーションできます
- **WebIDE ならインストール不要** — ブラウザで [openblink.org](https://openblink.org/) を開けばすぐにプログラミング開始。IDE のセットアップも SDK も拡張機能も不要 — mruby コンパイラは WebAssembly で動作し、プログラム転送は WebBluetooth を使用。ツールチェーン全体が一つの Web ページに内蔵

**エンドユーザー向け（「DIY できる価値」）：**

- 自分が所有するデバイスの振る舞いをカスタマイズ — ショートカットの個人設定、ルーティンの自動化、製品を自分のニーズに合わせた調整が可能
- 商業的に製造されたデバイス上で自作プログラムを実行し、完成品を自分だけのプラットフォームに変える

権限レベルに応じた API 制限により、オープンさと安定性が共存します：デバイスは各信頼レベルに適したメソッドのみを公開するため、メーカーは安心して製品をユーザープログラミングに開放できます。

### 教育から製品まで

ひとつのエコシステムが**学習 → ホビー → 製品**をカバーします。初めて LED を点滅させるときも、製品を出荷するときも、同じツールチェーン、同じ言語、同じワークフローが使えます。

### Happy Hacking

OpenBlink は**実機でハッキングする喜び**を大切にしています。あらゆる設計判断がこの目標に奉仕します：

- **致命的なミスが起きない** — バグのある Ruby プログラムでデバイスが文鎮化することはありません。C レベルのファームウェアと BLE スタックは動作し続けるため、いつでも修正を送信できます。この安全ネットが大胆な実験と挑戦を促します — OpenBlink はやってみて学ぶ人のために作られています。
- **即時フィードバック** — 変更は 0.1 秒以内に反映され、フローを途切れさせない緊密な編集・テストループを維持します。
- **再起動なし** — マイコンは動作し続けるため、ワイヤレスデバッグコンソールのセッションが中断されることはありません。
- **完全ワイヤレス** — ウェアラブルを装着したまま、あるいは手の届きにくい場所に設置されたセンサに対しても、ケーブルに縛られずに開発できます。
- **ゼロセットアップ** — OpenBlink WebIDE ならインストール不要。ブラウザを開いて [openblink.org](https://openblink.org/) にアクセスすれば、すぐにハッキング開始。mruby コンパイラは WebAssembly で動作、プログラム転送は WebBluetooth — ツールチェーン全体が一つの Web ページに収まっています。

これらの特徴が合わさり、Build & Blink するすべての人に**ハッピーハッキング体験**を生み出します。

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
