# OpenBlink WebIDE

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/OpenBlink/openblink-webide)

English text is followed by Chinese and Japanese translations. / 英文后面是中文和日文翻译。/ 英語の文章の後に中国語と日本語訳が続きます。

## What is OpenBlink WebIDE

- Web browser-based developing environment. (Uses WebBluetooth, WebAssembly and JavaScript.)
- Provide "Thinking Speed Prototyping" not only to embedded software engineers, but to anyone who wants to try out ideas quickly, easily, and on real devices. (Without special equipment.)
- Provide "DIY-able value" where end users can run the programs they create on their own devices. (We call it "Build & Blink".)

For AI-powered comprehensive documentation that helps you understand the codebase, visit [DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide).

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

## 什么是 OpenBlink WebIDE

- 基于网络浏览器的开发环境。（使用 WebBluetooth、WebAssembly 和 JavaScript。）
- 提供"思考速度原型设计"，不仅适用于嵌入式软件工程师，还适用于任何想要在真实设备上快速、轻松尝试想法的人。（无需特殊设备。）
- 提供"可 DIY 价值"，最终用户可以在自己的设备上运行他们创建的程序。（我们称之为"构建与闪烁"。）

如需查阅AI驱动的全面文档以帮助您理解代码库，请访问 [DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide)。

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

## OpenBlink WebIDE とは

- Web ブラウザベースの開発環境。（WebBluetooth、WebAssembly、JavaScript を使用。）
- 「思考速度プロトタイピング」を組込みソフトウェアエンジニアだけでなく、アイデアを素早く、簡単に、実機で試したい人にも提供。（特別な機器不要。）
- エンドユーザーが自分のデバイスで作成したプログラムを実行できる「DIY 可能な価値」を提供。（私たちはこれを「Build & Blink」と呼んでいます。）

コードベースの理解を助けるAI駆動の包括的なドキュメントは、[DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide) をご覧ください。

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
