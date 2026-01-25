# Creating Board Configurations

This guide explains how to add support for new microcontroller boards to OpenBlink WebIDE.

## Directory Structure

Create files in the `public_html/boards/` directory:

```
public_html/boards/
└── your-board-id/
    ├── config.json          # Board metadata (required)
    ├── sample.rb            # Sample code (required)
    ├── reference.md         # API reference (required)
    ├── board-config.js      # Simulator UI configuration (required if simulator enabled)
    ├── ui-components.js     # UI generation functions (required if simulator enabled)
    └── api-definitions.js   # mruby/c API definitions (required if simulator enabled)
```

Even if you don't use the simulator, the three files `config.json`, `sample.rb`, and `reference.md` are required.

## Required Files (Basic Configuration)

### 1. config.json

This file defines the board metadata and is loaded by BoardManager when the WebIDE starts. See `public_html/js/board-manager.js` for implementation details.

```json
{
  "name": "your-board-id",
  "displayName": "Your Board Display Name",
  "manufacturer": "Manufacturer Name",
  "description": "Description of your board",
  "simulator": {
    "enabled": true,
    "description": "Simulator description"
  }
}
```

Field descriptions:

- `name` - Board ID used internally (required, must match directory name)
- `displayName` - Display name shown in the board selector dropdown (required)
- `manufacturer` - Manufacturer name (optional)
- `description` - Board description (optional)
- `simulator.enabled` - Enable/disable simulator functionality (required, set to `false` if not using simulator)
- `simulator.description` - Simulator description (optional)

### 2. sample.rb

This file contains sample Ruby code that is automatically loaded into the editor when the board is selected. It helps users get started quickly with a working example.

The sample code should demonstrate basic functionality of the board, such as LED control or sensor reading. Keep it simple and well-commented so users can understand and modify it easily.

Example structure:

```ruby
# Basic LED blink example for Your Board

while true
  LED.set([255, 0, 0])  # Red
  sleep 0.5
  LED.set([0, 0, 0])    # Off
  sleep 0.5
end
```

### 3. reference.md

This file provides API reference documentation displayed in the right panel of the WebIDE. It is parsed by BoardManager's Markdown parser and rendered as HTML.

The Markdown parser supports:

- Headings (`#`, `##`, `###`)
- Unordered lists (`-` or `*`)
- Paragraphs
- Inline code (`` `code` ``)

Example structure (see `public_html/boards/xiao-nrf54l15/reference.md` for a complete example):

```markdown
# Your Board Function Reference

## LED Control

### LED.set([r, g, b])

Sets the built-in LED to the specified RGB color.

- `r` - Red value (0-255)
- `g` - Green value (0-255)
- `b` - Blue value (0-255)

## Timer Functions

### sleep(seconds)

Pauses program execution for the specified number of seconds.

- `seconds` - Number of seconds to wait (can be a decimal)
- Example: `sleep 1` - Wait for 1 second
```

The following files are only required if you want to enable the simulator for your board (`simulator.enabled: true` in config.json).

### 4. board-config.js

Defines basic board settings for the simulator:

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

### 6. ui-components.js

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
