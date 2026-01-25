# 为 WebSimulator 创建开发板配置

本指南说明如何在不重新编译 C 代码的情况下为 WebSimulator 添加新的微控制器开发板支持。

## 目录结构

在 `public_html/boards/` 目录中创建文件：

```
public_html/boards/
└── your-board-id/
    ├── board-config.js      # 开发板配置
    ├── ui-components.js     # UI 生成
    └── api-definitions.js   # mruby/c API 定义
```

## 必需文件

### 1. board-config.js

定义基本开发板设置：

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

### 2. api-definitions.js

使用 `MrubycWasmAPI` 类为 mruby/c 定义类和方法：

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

### 3. ui-components.js

生成开发板特定的 UI 元素：

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

## 为开发板启用模拟器

在开发板的 `config.json` 中添加 `simulator` 配置：

```json
{
  "name": "your-board-id",
  "displayName": "Your Board Name",
  "simulator": {
    "enabled": true
  }
}
```

## WASM API 参考

| C 函数 | JavaScript API | 描述 |
|--------|----------------|------|
| `mrbc_wasm_get_class_object()` | `api.getClassObject()` | 获取 Object 类指针 |
| `mrbc_wasm_define_class()` | `api.defineClass(name, super)` | 定义新类 |
| `mrbc_wasm_define_method()` | `api.defineMethod(cls, name, func)` | 定义方法 |
| `mrbc_wasm_get_int_arg()` | `api.getIntArg(vPtr, index)` | 获取整数参数 |
| `mrbc_wasm_get_float_arg()` | `api.getFloatArg(vPtr, index)` | 获取浮点参数 |
| `mrbc_wasm_is_numeric_arg()` | `api.isNumericArg(vPtr, index)` | 检查参数是否为数值 |
| `mrbc_wasm_set_return_bool()` | `api.setReturnBool(vPtr, val)` | 返回布尔值 |
| `mrbc_wasm_set_return_nil()` | `api.setReturnNil(vPtr)` | 返回 nil |
| `mrbc_wasm_set_return_int()` | `api.setReturnInt(vPtr, val)` | 返回整数值 |
| `mrbc_wasm_set_return_float()` | `api.setReturnFloat(vPtr, val)` | 返回浮点值 |
| `mrbc_wasm_instance_new()` | `api.instanceNew(cls)` | 创建新类实例 |
| `mrbc_wasm_set_global_const()` | `api.setGlobalConst(name, value)` | 设置全局常量 |
| `mrbc_wasm_free_instance()` | `api.freeInstance(instance)` | 释放实例内存 |

## 重要注意事项

1. **内存管理**：使用 `addFunction()` 创建的回调函数必须在切换开发板时使用 `removeFunction()` 释放。

2. **回调签名**：mruby/c 方法回调使用 `'viii'` 签名（void, int, int, int）。

3. **符号 ID 匹配**：开发板 API 必须在字节码加载后（通过 `mrubycOnTaskCreated` 回调）定义，以确保符号 ID 匹配。
