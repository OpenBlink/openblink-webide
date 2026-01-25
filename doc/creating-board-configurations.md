# Creating Board Configurations for WebSimulator

This guide explains how to add support for new microcontroller boards to the WebSimulator without recompiling C code.

## Directory Structure

Create files in the `public_html/boards/` directory:

```
public_html/boards/
└── your-board-id/
    ├── board-config.js      # Board configuration
    ├── ui-components.js     # UI generation
    └── api-definitions.js   # mruby/c API definitions
```

## Required Files

### 1. board-config.js

Defines basic board settings:

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

Defines classes and methods for mruby/c using the `MrubycWasmAPI` class:

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

Generates board-specific UI elements:

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

## Enabling Simulator for a Board

Add `simulator` configuration to the board's `config.json`:

```json
{
  "name": "your-board-id",
  "displayName": "Your Board Name",
  "simulator": {
    "enabled": true
  }
}
```

## WASM API Reference

| C Function | JavaScript API | Description |
|------------|----------------|-------------|
| `mrbc_wasm_get_class_object()` | `api.getClassObject()` | Get Object class pointer |
| `mrbc_wasm_define_class()` | `api.defineClass(name, super)` | Define a new class |
| `mrbc_wasm_define_method()` | `api.defineMethod(cls, name, func)` | Define a method |
| `mrbc_wasm_get_int_arg()` | `api.getIntArg(vPtr, index)` | Get integer argument |
| `mrbc_wasm_get_float_arg()` | `api.getFloatArg(vPtr, index)` | Get float argument |
| `mrbc_wasm_is_numeric_arg()` | `api.isNumericArg(vPtr, index)` | Check if argument is numeric |
| `mrbc_wasm_set_return_bool()` | `api.setReturnBool(vPtr, val)` | Return boolean value |
| `mrbc_wasm_set_return_nil()` | `api.setReturnNil(vPtr)` | Return nil |
| `mrbc_wasm_set_return_int()` | `api.setReturnInt(vPtr, val)` | Return integer value |
| `mrbc_wasm_set_return_float()` | `api.setReturnFloat(vPtr, val)` | Return float value |
| `mrbc_wasm_instance_new()` | `api.instanceNew(cls)` | Create new class instance |
| `mrbc_wasm_set_global_const()` | `api.setGlobalConst(name, value)` | Set global constant |
| `mrbc_wasm_free_instance()` | `api.freeInstance(instance)` | Free instance memory |

## Important Notes

1. **Memory Management**: Callback functions created with `addFunction()` must be released with `removeFunction()` when switching boards.

2. **Callback Signature**: mruby/c method callbacks use the `'viii'` signature (void, int, int, int).

3. **Symbol ID Matching**: Board APIs must be defined after bytecode is loaded (via `mrubycOnTaskCreated` callback) to ensure symbol IDs match.
