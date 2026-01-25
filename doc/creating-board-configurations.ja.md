# ボード設定の作成

このガイドでは、OpenBlink WebIDE に新しいマイコンボードのサポートを追加する方法を説明します。

## ディレクトリ構造

`public_html/boards/` ディレクトリにファイルを作成します：

```
public_html/boards/
└── your-board-id/
    ├── config.json          # ボードメタデータ（必須）
    ├── sample.rb            # サンプルコード（必須）
    ├── reference.md         # API リファレンス（必須）
    ├── board-config.js      # シミュレータ UI 設定（シミュレータ有効時に必須）
    ├── ui-components.js     # UI 生成関数（シミュレータ有効時に必須）
    └── api-definitions.js   # mruby/c API 定義（シミュレータ有効時に必須）
```

シミュレータを使用しない場合でも、`config.json`、`sample.rb`、`reference.md` の 3 つのファイルは必須です。

## 必須ファイル（基本設定）

### 1. config.json

このファイルはボードのメタデータを定義し、WebIDE 起動時に BoardManager によって読み込まれます。実装の詳細は `public_html/js/board-manager.js` を参照してください。

```json
{
  "name": "your-board-id",
  "displayName": "ボードの表示名",
  "manufacturer": "メーカー名",
  "description": "ボードの説明",
  "simulator": {
    "enabled": true,
    "description": "シミュレータの説明"
  }
}
```

フィールドの説明：

- `name` - 内部で使用されるボード ID（必須、ディレクトリ名と一致する必要があります）
- `displayName` - ボード選択ドロップダウンに表示される名前（必須）
- `manufacturer` - メーカー名（オプション）
- `description` - ボードの説明（オプション）
- `simulator.enabled` - シミュレータ機能の有効/無効（必須、シミュレータを使用しない場合は `false` に設定）
- `simulator.description` - シミュレータの説明（オプション）

### 2. sample.rb

このファイルには、ボード選択時にエディタに自動的に読み込まれるサンプル Ruby コードが含まれています。動作するサンプルを提供することで、ユーザーがすぐに開始できるようにします。

サンプルコードは、LED 制御やセンサー読み取りなど、ボードの基本機能をデモンストレーションする必要があります。ユーザーが理解しやすく修正しやすいように、シンプルでコメント付きにしてください。

構造の例：

```ruby
# Your Board 用の基本的な LED 点滅サンプル

while true
  LED.set([255, 0, 0])  # 赤
  sleep 0.5
  LED.set([0, 0, 0])    # 消灯
  sleep 0.5
end
```

### 3. reference.md

このファイルは、WebIDE の右パネルに表示される API リファレンスドキュメントを提供します。BoardManager の Markdown パーサーによって解析され、HTML としてレンダリングされます。

Markdown パーサーがサポートする機能：

- 見出し（`#`、`##`、`###`）
- 箇条書きリスト（`-` または `*`）
- 段落
- インラインコード（`` `code` ``）

構造の例（完全な例は `public_html/boards/xiao-nrf54l15/reference.md` を参照）：

```markdown
# Your Board 関数リファレンス

## LED 制御

### LED.set([r, g, b])

内蔵 LED を指定した RGB カラーに設定します。

- `r` - 赤の値（0-255）
- `g` - 緑の値（0-255）
- `b` - 青の値（0-255）

## タイマー関数

### sleep(seconds)

指定した秒数だけプログラムの実行を一時停止します。

- `seconds` - 待機する秒数（小数も可）
- 例：`sleep 1` - 1 秒待機
```

以下のファイルは、ボードでシミュレータを有効にする場合（config.json で `simulator.enabled: true`）にのみ必要です。

### 4. board-config.js

シミュレータ用の基本的なボード設定を定義します：

```javascript
const BOARD_CONFIG = {
  name: "Your Board Name",
  id: "your-board-id",
  description: "Description of your board",
  
  ui: {
    matrixWidth: 10,
    matrixHeight: 6,
    totalPixels: 60
  }
};

if (typeof window !== 'undefined') {
  window.BOARD_CONFIG = BOARD_CONFIG;
}
```

### 5. api-definitions.js

`MrubycWasmAPI` クラスを使用して mruby/c のクラスとメソッドを定義します：

```javascript
let registeredCallbacks = [];

class MrubycWasmAPI {
  constructor(module) {
    this.module = module;
  }

  getClassObject() {
    return this.module._mrbc_wasm_get_class_object();
  }

  defineClass(name, superClass) {
    return this.module.ccall(
      'mrbc_wasm_define_class', 'number',
      ['string', 'number'], [name, superClass]
    );
  }

  defineMethod(cls, name, func) {
    this.module.ccall(
      'mrbc_wasm_define_method', null,
      ['number', 'string', 'number'], [cls, name, func]
    );
  }

  getIntArg(vPtr, index) {
    return this.module._mrbc_wasm_get_int_arg(vPtr, index);
  }

  getFloatArg(vPtr, index) {
    return this.module._mrbc_wasm_get_float_arg(vPtr, index);
  }

  isNumericArg(vPtr, index) {
    return this.module._mrbc_wasm_is_numeric_arg(vPtr, index) !== 0;
  }

  setReturnBool(vPtr, val) {
    this.module._mrbc_wasm_set_return_bool(vPtr, val ? 1 : 0);
  }

  setReturnNil(vPtr) {
    this.module._mrbc_wasm_set_return_nil(vPtr);
  }

  setReturnInt(vPtr, val) {
    this.module._mrbc_wasm_set_return_int(vPtr, val);
  }

  setReturnFloat(vPtr, val) {
    this.module._mrbc_wasm_set_return_float(vPtr, val);
  }

  instanceNew(cls) {
    return this.module._mrbc_wasm_instance_new(cls);
  }

  setGlobalConst(name, value) {
    this.module.ccall(
      'mrbc_wasm_set_global_const', null,
      ['string', 'number'], [name, value]
    );
  }

  freeInstance(instance) {
    this.module._mrbc_wasm_free_instance(instance);
  }

  addFunction(func, signature) {
    return this.module.addFunction(func, signature);
  }

  removeFunction(funcPtr) {
    this.module.removeFunction(funcPtr);
  }
}

function defineYourAPI(mrubycModule) {
  const api = new MrubycWasmAPI(mrubycModule);
  const classObject = api.getClassObject();
  
  const yourClass = api.defineClass('YourClass', classObject);
  
  const methodCallback = api.addFunction((vmPtr, vPtr, argc) => {
    if (api.isNumericArg(vPtr, 1)) {
      const arg1 = api.getIntArg(vPtr, 1);
      api.setReturnBool(vPtr, true);
    } else {
      api.setReturnBool(vPtr, false);
    }
  }, 'viii');
  
  registeredCallbacks.push(methodCallback);
  api.defineMethod(yourClass, 'method_name', methodCallback);
  
  const instance = api.instanceNew(yourClass);
  if (instance) {
    api.setGlobalConst('YOUR_CONSTANT', instance);
  }
}

function cleanupYourAPI(mrubycModule) {
  for (const callback of registeredCallbacks) {
    try {
      mrubycModule.removeFunction(callback);
    } catch (e) {}
  }
  registeredCallbacks = [];
}

if (typeof window !== 'undefined') {
  window.defineYourAPI = defineYourAPI;
  window.cleanupYourAPI = cleanupYourAPI;
}
```

### 6. ui-components.js

ボード固有の UI 要素を生成します：

```javascript
function createBoardUI(container, config) {
  container.innerHTML = '';
  
  const title = document.createElement('div');
  title.textContent = `${config.ui.matrixWidth}x${config.ui.matrixHeight} RGB MATRIX for ${config.name}`;
  container.appendChild(title);
  
  const dotContainer = document.createElement('div');
  dotContainer.id = 'simulator-dot-container';
  container.appendChild(dotContainer);
  
  for (let i = 0; i < config.ui.totalPixels; i++) {
    const dot = document.createElement('div');
    dot.id = 'simulator-pixel-' + i;
    dot.className = 'simulator-dot';
    dot.textContent = i;
    dotContainer.appendChild(dot);
  }
}

function setPixelColor(id, red, green, blue) {
  const targetDot = document.getElementById('simulator-pixel-' + id);
  if (targetDot) {
    targetDot.style.backgroundColor = `rgb(${red}, ${green}, ${blue})`;
    const brightness = red + green + blue;
    targetDot.style.color = brightness > 128 * 3 ? '#666' : 'white';
  }
}

function cleanupBoardUI(container) {
  container.innerHTML = '';
}

if (typeof window !== 'undefined') {
  window.createBoardUI = createBoardUI;
  window.setPixelColor = setPixelColor;
  window.cleanupBoardUI = cleanupBoardUI;
}
```

## ボードでシミュレータを有効にする

ボードの `config.json` に `simulator` 設定を追加します：

```json
{
  "name": "your-board-id",
  "displayName": "Your Board Name",
  "simulator": {
    "enabled": true
  }
}
```

## WASM API リファレンス

| C 関数 | JavaScript API | 説明 |
|--------|----------------|------|
| `mrbc_wasm_get_class_object()` | `api.getClassObject()` | Object クラスポインタを取得 |
| `mrbc_wasm_define_class()` | `api.defineClass(name, super)` | 新しいクラスを定義 |
| `mrbc_wasm_define_method()` | `api.defineMethod(cls, name, func)` | メソッドを定義 |
| `mrbc_wasm_get_int_arg()` | `api.getIntArg(vPtr, index)` | 整数引数を取得 |
| `mrbc_wasm_get_float_arg()` | `api.getFloatArg(vPtr, index)` | 浮動小数点引数を取得 |
| `mrbc_wasm_is_numeric_arg()` | `api.isNumericArg(vPtr, index)` | 引数が数値かチェック |
| `mrbc_wasm_set_return_bool()` | `api.setReturnBool(vPtr, val)` | ブール値を返す |
| `mrbc_wasm_set_return_nil()` | `api.setReturnNil(vPtr)` | nil を返す |
| `mrbc_wasm_set_return_int()` | `api.setReturnInt(vPtr, val)` | 整数値を返す |
| `mrbc_wasm_set_return_float()` | `api.setReturnFloat(vPtr, val)` | 浮動小数点値を返す |
| `mrbc_wasm_instance_new()` | `api.instanceNew(cls)` | 新しいクラスインスタンスを作成 |
| `mrbc_wasm_set_global_const()` | `api.setGlobalConst(name, value)` | グローバル定数を設定 |
| `mrbc_wasm_free_instance()` | `api.freeInstance(instance)` | インスタンスメモリを解放 |

## 重要な注意事項

1. **メモリ管理**：`addFunction()` で作成したコールバック関数は、ボード切り替え時に `removeFunction()` で解放する必要があります。

2. **コールバックシグネチャ**：mruby/c メソッドコールバックは `'viii'` シグネチャ（void, int, int, int）を使用します。

3. **シンボル ID の一致**：ボード API はバイトコードがロードされた後（`mrubycOnTaskCreated` コールバック経由）に定義する必要があります。これによりシンボル ID が一致します。
