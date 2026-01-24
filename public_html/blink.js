/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 */

// Global variables for BLE characteristics
let programCharacteristic;
let negotiatedMtuCharacteristic;

// Connection state management
let isConnected = false;
let connectedDevice = null;
let userInitiatedDisconnect = false;
let reconnectAttempts = 0;
let deviceWithDisconnectListener = null;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;

// BLE UUIDs
const OPENBLINK_SERVICE_UUID = "227da52c-e13a-412b-befb-ba2256bb7fbe";
const OPENBLINK_PROGRAM_CHARACTERISTIC_UUID = "ad9fdd56-1135-4a84-923c-ce5a244385e7";
const OPENBLINK_CONSOLE_CHARACTERISTIC_UUID = "a015b3de-185a-4252-aa04-7a87d38ce148";
const OPENBLINK_NEGOTIATED_MTU_CHARACTERISTIC_UUID = "ca141151-3113-448b-b21a-6a6203d253ff";

// MTU configuration
const MAX_CHUNK_SIZE = 20;
const DATA_HEADER_SIZE = 6;
const DATA_PAYLOAD_SIZE = MAX_CHUNK_SIZE - DATA_HEADER_SIZE;
const PROGRAM_HEADER_SIZE = 8;
const DEFAULT_MTU = 20;
const REQUESTED_MTU = 512;
let negotiatedMTU = DEFAULT_MTU;

const OPENBLINK_WEBIDE_VERSION = "0.3.4";

// Global error handlers for JavaScript runtime errors
window.onerror = function(message, source, lineno, colno, error) {
  appendToConsole('Error: ' + message + ' (at line ' + lineno + ')');
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  const reason = event.reason;
  const message = reason?.message ?? String(reason);
  appendToConsole('Promise Error: ' + message);
});

appendToConsole(`OpenBlink WebIDE v${OPENBLINK_WEBIDE_VERSION} started.`);

function appendToConsole(message) {
  if (message === undefined || message === null) {
    return;
  }
  const msgStr = String(message).trim();
  if (msgStr === "") {
    return;
  }
  const consoleOutput = document.getElementById("consoleOutput");
  const line = document.createElement("div");
  line.textContent = msgStr;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Update the connection status UI
function updateConnectionStatus(status) {
  const statusElement = document.getElementById("connectionStatus");
  const connectButton = document.getElementById("ble-connect");
  const disconnectButton = document.getElementById("ble-disconnect");
  const runMainButton = document.getElementById("run-main");
  const softResetButton = document.getElementById("soft-reset");

  if (!statusElement) return;

  statusElement.className = "connection-status";

  switch (status) {
    case "connected":
      statusElement.textContent = "Connected";
      statusElement.classList.add("connected");
      isConnected = true;
      if (connectButton) connectButton.disabled = true;
      if (disconnectButton) disconnectButton.disabled = false;
      if (runMainButton) runMainButton.disabled = false;
      if (softResetButton) softResetButton.disabled = false;
      break;
    case "disconnected":
      statusElement.textContent = "Disconnected";
      statusElement.classList.add("disconnected");
      isConnected = false;
      if (connectButton) connectButton.disabled = false;
      if (disconnectButton) disconnectButton.disabled = true;
      if (runMainButton) runMainButton.disabled = true;
      if (softResetButton) softResetButton.disabled = true;
      break;
    case "connecting":
      statusElement.textContent = "Connecting...";
      statusElement.classList.add("connecting");
      isConnected = false;
      if (connectButton) connectButton.disabled = true;
      if (disconnectButton) disconnectButton.disabled = true;
      if (runMainButton) runMainButton.disabled = true;
      if (softResetButton) softResetButton.disabled = true;
      break;
    case "reconnecting":
      statusElement.textContent = "Reconnecting...";
      statusElement.classList.add("connecting");
      isConnected = false;
      if (connectButton) connectButton.disabled = true;
      if (disconnectButton) disconnectButton.disabled = false;
      if (runMainButton) runMainButton.disabled = true;
      if (softResetButton) softResetButton.disabled = true;
      break;
  }
}

// Disconnect from the BLE device
function disconnectBluetooth() {
  userInitiatedDisconnect = true;
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS;

  if (connectedDevice && connectedDevice.gatt.connected) {
    appendToConsole("Disconnecting from device...");
    connectedDevice.gatt.disconnect();
  }

  programCharacteristic = null;
  negotiatedMtuCharacteristic = null;
  connectedDevice = null;
  negotiatedMTU = DEFAULT_MTU;
  updateConnectionStatus("disconnected");
  appendToConsole("Disconnected from device.");
}

// Handle unexpected disconnection with auto-reconnect
function handleDisconnect(event) {
  const device = event.target;
  appendToConsole("Device disconnected: " + device.name);

  programCharacteristic = null;
  negotiatedMtuCharacteristic = null;
  negotiatedMTU = DEFAULT_MTU;

  if (userInitiatedDisconnect) {
    userInitiatedDisconnect = false;
    reconnectAttempts = 0;
    updateConnectionStatus("disconnected");
    return;
  }

  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    attemptReconnect(device);
  } else {
    appendToConsole("Max reconnection attempts reached. Please reconnect manually.");
    connectedDevice = null;
    reconnectAttempts = 0;
    updateConnectionStatus("disconnected");
  }
}

// Attempt to reconnect with exponential backoff
function attemptReconnect(device) {
  reconnectAttempts++;
  const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);

  appendToConsole(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`);
  updateConnectionStatus("reconnecting");

  setTimeout(async () => {
    if (userInitiatedDisconnect) {
      reconnectAttempts = 0;
      updateConnectionStatus("disconnected");
      return;
    }

    try {
      await connectToDevice(device);

      // If the user requested a disconnect while we were reconnecting,
      // honor that request and avoid flipping the UI back to "Connected".
      if (userInitiatedDisconnect) {
        appendToConsole("Reconnect attempt was cancelled by user.");
        try {
          if (connectedDevice && connectedDevice.gatt && connectedDevice.gatt.connected) {
            connectedDevice.gatt.disconnect();
          }
        } catch (disconnectError) {
          appendToConsole("Error while enforcing user disconnect after reconnect: " + disconnectError.message);
        }
        isConnected = false;
        reconnectAttempts = 0;
        updateConnectionStatus("disconnected");
        return;
      }

      reconnectAttempts = 0;
      appendToConsole("Reconnected successfully!");
    } catch (error) {
      appendToConsole("Reconnection failed: " + error.message);
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        attemptReconnect(device);
      } else {
        appendToConsole("Max reconnection attempts reached. Please reconnect manually.");
        connectedDevice = null;
        reconnectAttempts = 0;
        updateConnectionStatus("disconnected");
      }
    }
  }, delay);
}

// Connect to a BLE device (used for both initial connection and reconnection)
async function connectToDevice(device) {
  const server = await device.gatt.connect();
  console.log("Connected to GATT server");

  const service = await server.getPrimaryService(OPENBLINK_SERVICE_UUID);
  console.log("Got service:", service);

  const characteristics = await Promise.all([
    service.getCharacteristic(OPENBLINK_CONSOLE_CHARACTERISTIC_UUID),
    service.getCharacteristic(OPENBLINK_PROGRAM_CHARACTERISTIC_UUID),
    service.getCharacteristic(OPENBLINK_NEGOTIATED_MTU_CHARACTERISTIC_UUID),
  ]);

  const consoleCharacteristic = characteristics[0];
  programCharacteristic = characteristics[1];
  negotiatedMtuCharacteristic = characteristics[2];

  console.log("Got console characteristic:", consoleCharacteristic);
  console.log("Got program characteristic:", programCharacteristic);
  console.log("Got negotiatedMTU characteristic:", negotiatedMtuCharacteristic);

  await negotiateMTU();

  consoleCharacteristic.addEventListener("characteristicvaluechanged", (event) => {
    const value = new TextDecoder().decode(event.target.value);
    appendToConsole(value);
  });

  await consoleCharacteristic.startNotifications();

  connectedDevice = device;
  updateConnectionStatus("connected");
  appendToConsole("Connected to device: " + device.name);
}

async function negotiateMTU() {
  if (!programCharacteristic || !programCharacteristic.service || !programCharacteristic.service.device) {
    console.warn("Cannot negotiate MTU: characteristic not available");
    appendToConsole("MTU negotiation skipped: device not ready. Using default MTU: " + DEFAULT_MTU);
    negotiatedMTU = DEFAULT_MTU;
    return;
  }

  const gattServer = programCharacteristic.service.device.gatt;
  if (gattServer.requestMTU) {
    try {
      negotiatedMTU = await gattServer.requestMTU(REQUESTED_MTU);
      console.log(`Negotiated MTU: ${negotiatedMTU}`);
    } catch (error) {
      console.warn(`MTU negotiation failed: ${error.message}. Using default MTU: ${DEFAULT_MTU}`);
      appendToConsole("MTU negotiation failed. Using default MTU: " + DEFAULT_MTU);
      negotiatedMTU = DEFAULT_MTU;
    }
  } else {
    try {
      const valueDataView = await negotiatedMtuCharacteristic.readValue();
      const devicemtu = valueDataView.getUint16(0, true);
      negotiatedMTU = devicemtu - 3;
      console.log("Device negotiated MTU(uint16):", devicemtu);
    } catch (error) {
      console.error("Device negotiated MTU Error:", error);
      appendToConsole("Failed to read device MTU. Using default MTU: " + DEFAULT_MTU);
      negotiatedMTU = DEFAULT_MTU;
    }
    console.log(
      `MTU negotiation not supported. Using device's negotiated MTU: ${negotiatedMTU}`
    );
  }
}

async function writeCharacteristic(characteristic, buffer) {
  if (!characteristic) {
    throw new Error("Characteristic not available");
  }
  if (characteristic.properties.writeWithoutResponse) {
    return characteristic.writeValueWithoutResponse(buffer);
  } else {
    console.log("writeWithoutResponse is not supported.");
    return characteristic.writeValue(buffer);
  }
}

async function sendReset() {
  if (!isConnected || !programCharacteristic) {
    appendToConsole("Error: Not connected to device");
    return;
  }

  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint8(0, 0x01); // version = 0x01
  view.setUint8(1, "R".charCodeAt(0)); // command = 'R'

  try {
    await programCharacteristic.writeValue(buffer);
    appendToConsole("Send [R]eset Complete");
  } catch (error) {
    appendToConsole("Send [R]eset Error: " + error.message);
  }
}

async function sendReload() {
  if (!isConnected || !programCharacteristic) {
    appendToConsole("Error: Not connected to device");
    return;
  }

  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint8(0, 0x01); // version = 0x01
  view.setUint8(1, "L".charCodeAt(0)); // command = 'L'

  try {
    await writeCharacteristic(programCharacteristic, buffer);
    appendToConsole("Send re[L]oad Complete");
  } catch (error) {
    appendToConsole("Send re[L]oad Error: " + error.message);
  }
}

async function sendFirmware(mrbContent) {
  if (!isConnected) {
    appendToConsole("Error: Not connected to device");
    return;
  }

  if (!programCharacteristic) {
    appendToConsole("Error: Program characteristic not available");
    console.error("no program characteristic");
    return;
  }

  const contentLength = mrbContent.length;
  const crc16 = crc16_reflect(0xd175, 0xffff, mrbContent);
  const slot = 2;

  appendToConsole(
    `Sending bytecode: slot=${slot}, length=${contentLength}bytes, CRC16=${crc16.toString(
      16
    )}, MTU=${negotiatedMTU}`
  );

  const DATA_PAYLOAD_SIZE = negotiatedMTU - DATA_HEADER_SIZE;
  console.log(`DATA_PAYLOAD_SIZE: ${DATA_PAYLOAD_SIZE} Bytes`);

  for (let offset = 0; offset < contentLength; offset += DATA_PAYLOAD_SIZE) {
    const chunkDataSize = Math.min(DATA_PAYLOAD_SIZE, contentLength - offset);
    const buffer = new ArrayBuffer(DATA_HEADER_SIZE + chunkDataSize);
    const view = new DataView(buffer);

    view.setUint8(0, 0x01); // version = 0x01
    view.setUint8(1, "D".charCodeAt(0)); // command = 'D'
    view.setUint16(2, offset, true);
    view.setUint16(4, chunkDataSize, true);

    const payload = new Uint8Array(buffer, DATA_HEADER_SIZE, chunkDataSize);
    payload.set(mrbContent.subarray(offset, offset + chunkDataSize));

    try {
      await writeCharacteristic(programCharacteristic, buffer);
      appendToConsole(
        `Send [D]ata Ok: Offset=${offset}, Size=${chunkDataSize}`
      );
    } catch (error) {
      appendToConsole(`Send [D]ata Error: Offset=${offset}, Error: ${error.message}`);
      return;
    }
  }

  const programBuffer = new ArrayBuffer(PROGRAM_HEADER_SIZE);
  const programView = new DataView(programBuffer);

  programView.setUint8(0, 0x01); // version = 0x01
  programView.setUint8(1, "P".charCodeAt(0)); // command = 'P'
  programView.setUint16(2, contentLength, true); // length
  programView.setUint16(4, crc16, true); // crc: CRC16
  programView.setUint8(6, slot); // slot
  programView.setUint8(7, 0); // reserved

  try {
    await writeCharacteristic(programCharacteristic, programBuffer);
    appendToConsole("Send [P]rogram Complete");
    sendReload();
  } catch (error) {
    appendToConsole("Send [P]rogram Error: " + error.message);
  }
}

Module.onRuntimeInitialized = () => {
  console.log("Emscripten runtime initialized.");

  const bleConnectButton = document.getElementById("ble-connect");
  const bleDisconnectButton = document.getElementById("ble-disconnect");
  const runMainButton = document.getElementById("run-main");
  const rebootButton = document.getElementById("soft-reset");

  // Initialize button states
  updateConnectionStatus("disconnected");

  rebootButton.addEventListener("click", () => {
    if (!isConnected) {
      appendToConsole("Error: Not connected to device");
      return;
    }
    rebootButton.disabled = true;
    sendReset().finally(() => {
      if (isConnected) {
        rebootButton.disabled = false;
      }
    });
  });

  bleDisconnectButton.addEventListener("click", () => {
    disconnectBluetooth();
  });

  bleConnectButton.addEventListener("click", () => {
    appendToConsole("Connecting to device...");
    updateConnectionStatus("connecting");
    userInitiatedDisconnect = false;
    reconnectAttempts = 0;

    navigator.bluetooth
      .requestDevice({
        filters: [
          { namePrefix: "OpenBlink" },
          { services: [OPENBLINK_SERVICE_UUID] },
        ],
      })
      .then((device) => {
        appendToConsole("Selected device: " + device.name);
        if (deviceWithDisconnectListener !== device) {
          if (deviceWithDisconnectListener) {
            deviceWithDisconnectListener.removeEventListener('gattserverdisconnected', handleDisconnect);
          }
          device.addEventListener('gattserverdisconnected', handleDisconnect);
          deviceWithDisconnectListener = device;
        }
        return connectToDevice(device);
      })
      .catch((error) => {
        if (error.name === 'NotFoundError') {
          appendToConsole("Connection cancelled: No device selected");
        } else {
          appendToConsole("Connection Error: " + error.message);
        }
        console.error("Error:", error);
        updateConnectionStatus("disconnected");
      });
  });

  runMainButton.addEventListener("click", () => {
    if (!isConnected) {
      appendToConsole("Error: Not connected to device");
      return;
    }

    if (!programCharacteristic) {
      appendToConsole("Error: Program characteristic not available. Please reconnect.");
      return;
    }

    // Disable button during processing
    runMainButton.disabled = true;

    let argv = null;
    let argPointers = [];

    try {
      const rubyCode = editor.getValue();

      const sourceFileName = "temp.rb";
      const outputFileName = "temp.mrb";
      Module.FS.writeFile(sourceFileName, rubyCode);

      const args = ["mrbc", "-o", outputFileName, sourceFileName];
      const argc = args.length;

      argv = Module._malloc(args.length * 4);
      argPointers = args.map((arg) => {
        const ptr = Module._malloc(arg.length + 1);
        Module.stringToUTF8(arg, ptr, arg.length + 1);
        return ptr;
      });

      for (let i = 0; i < argPointers.length; i++) {
        Module.setValue(argv + i * 4, argPointers[i], "i32");
      }

      const start_mrbc = performance.now();
      const result = Module._main(argc, argv);
      const end_mrbc = performance.now();
      if (0 == result) {
        appendToConsole(
          "mrbc success!: (" + (end_mrbc - start_mrbc).toFixed(2) + "ms)"
        );
      } else {
        appendToConsole("mrbc failed with exit code: " + result);
        return;
      }

      const mrbContent = Module.FS.readFile(outputFileName);

      if (!programCharacteristic) {
        appendToConsole("Error: Program characteristic not available");
        console.error("no program characteristic");
        return;
      }

      const start_send = performance.now();
      sendFirmware(mrbContent)
        .then(() => {
          const end_send = performance.now();
          appendToConsole(
            "Sending bytecode: Complete! (" +
              (end_send - start_send).toFixed(2) +
              "ms)"
          );
        })
        .catch((error) => {
          appendToConsole("Sending bytecode Error: " + error.message);
        })
        .finally(() => {
          if (isConnected) {
            runMainButton.disabled = false;
          }
        });
    } catch (error) {
      appendToConsole("Error: " + error.message);
    } finally {
      // Always free allocated WASM memory
      if (argPointers.length > 0) {
        argPointers.forEach((ptr) => Module._free(ptr));
      }
      if (argv !== null) {
        Module._free(argv);
      }
      // Re-enable button if not waiting for sendFirmware
      if (isConnected && !programCharacteristic) {
        runMainButton.disabled = false;
      }
    }
  });
};
