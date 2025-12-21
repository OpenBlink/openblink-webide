# OpenBlink WebIDE

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/OpenBlink/openblink-webide)

English text is followed by Chinese and Japanese translations. / 英文后面是中文和日文翻译。/ 英語の文章の後に中国語と日本語訳が続きます。

## What is OpenBlink WebIDE

- Web browser-based developing environment. (Uses WebBluetooth, WebAssembly and JavaScript.)
- Provide "Thinking Speed Prototyping" not only to embedded software engineers, but to anyone who wants to try out ideas quickly, easily, and on real devices. (Without special equipment.)
- Provide "DIY-able value" where end users can run the programs they create on their own devices. (We call it "Build & Blink".)

For AI-powered comprehensive documentation that helps you understand the codebase, visit [DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide).

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
$ git submodule init
$ git submodule update
```

2. Install and Activate Emscripten in the `emsdk` Directory

```console
$ cd emsdk
emsdk $ ./emsdk install 4.0.22
emsdk $ ./emsdk activate 4.0.22
```

3. Build mruby in the `mruby` Directory

```console
$ cd ../mruby
mruby $ make
mruby $ rake MRUBY_CONFIG=../emscripten.rb
```

---

# OpenBlink WebIDE

## 什么是 OpenBlink WebIDE

- 基于网络浏览器的开发环境。（使用 WebBluetooth、WebAssembly 和 JavaScript。）
- 提供"思考速度原型设计"，不仅适用于嵌入式软件工程师，还适用于任何想要在真实设备上快速、轻松尝试想法的人。（无需特殊设备。）
- 提供"可 DIY 价值"，最终用户可以在自己的设备上运行他们创建的程序。（我们称之为"构建与闪烁"。）

如需查阅AI驱动的全面文档以帮助您理解代码库，请访问 [DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide)。

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
$ git submodule init
$ git submodule update
```

2. 在 `emsdk` 目录中安装并激活 Emscripten

```console
$ cd emsdk
emsdk $ ./emsdk install 4.0.22
emsdk $ ./emsdk activate 4.0.22
```

3. 在 `mruby` 目录中构建 mruby

```console
$ cd ../mruby
mruby $ make
mruby $ rake MRUBY_CONFIG=../emscripten.rb
```

---

# OpenBlink WebIDE

## OpenBlink WebIDE とは

- Web ブラウザベースの開発環境。（WebBluetooth、WebAssembly、JavaScript を使用。）
- 「思考速度プロトタイピング」を組込みソフトウェアエンジニアだけでなく、アイデアを素早く、簡単に、実機で試したい人にも提供。（特別な機器不要。）
- エンドユーザーが自分のデバイスで作成したプログラムを実行できる「DIY 可能な価値」を提供。（私たちはこれを「Build & Blink」と呼んでいます。）

コードベースの理解を助けるAI駆動の包括的なドキュメントは、[DeepWiki](https://deepwiki.com/OpenBlink/openblink-webide) をご覧ください。

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
$ git submodule init
$ git submodule update
```

2. `emsdk` ディレクトリで Emscripten をインストールして有効化

```console
$ cd emsdk
emsdk $ ./emsdk install 4.0.22
emsdk $ ./emsdk activate 4.0.22
```

3. `mruby` ディレクトリで mruby をビルド

```console
$ cd ../mruby
mruby $ make
mruby $ rake MRUBY_CONFIG=../emscripten.rb
```
