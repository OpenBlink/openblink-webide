/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 */

const BLEProtocol = (function() {
  const OPENBLINK_SERVICE_UUID = "227da52c-e13a-412b-befb-ba2256bb7fbe";
  const OPENBLINK_PROGRAM_CHARACTERISTIC_UUID = "ad9fdd56-1135-4a84-923c-ce5a244385e7";
  const OPENBLINK_CONSOLE_CHARACTERISTIC_UUID = "a015b3de-185a-4252-aa04-7a87d38ce148";
  const OPENBLINK_NEGOTIATED_MTU_CHARACTERISTIC_UUID = "ca141151-3113-448b-b21a-6a6203d253ff";

  const DATA_HEADER_SIZE = 6;
  const PROGRAM_HEADER_SIZE = 8;
  const DEFAULT_MTU = 20;
  const REQUESTED_MTU = 512;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const INITIAL_RECONNECT_DELAY = 1000;

  let programCharacteristic = null;
  let negotiatedMtuCharacteristic = null;
  let consoleCharacteristic = null;
  let isConnected = false;
  let connectedDevice = null;
  let userInitiatedDisconnect = false;
  let reconnectAttempts = 0;
  let deviceWithDisconnectListener = null;
  let negotiatedMTU = DEFAULT_MTU;

  // Named function for console characteristic event listener to avoid duplicates
  function handleConsoleValueChanged(event) {
    const value = new TextDecoder().decode(event.target.value);
    UIManager.appendToConsole(value);
  }

  async function negotiateMTU() {
    if (!programCharacteristic || !programCharacteristic.service || !programCharacteristic.service.device) {
      console.warn("Cannot negotiate MTU: characteristic not available");
      UIManager.appendToConsole("MTU negotiation skipped: device not ready. Using default MTU: " + DEFAULT_MTU);
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
        UIManager.appendToConsole("MTU negotiation failed. Using default MTU: " + DEFAULT_MTU);
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
        UIManager.appendToConsole("Failed to read device MTU. Using default MTU: " + DEFAULT_MTU);
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

    consoleCharacteristic = characteristics[0];
    programCharacteristic = characteristics[1];
    negotiatedMtuCharacteristic = characteristics[2];

    console.log("Got console characteristic:", consoleCharacteristic);
    console.log("Got program characteristic:", programCharacteristic);
    console.log("Got negotiatedMTU characteristic:", negotiatedMtuCharacteristic);

    await negotiateMTU();

    // Remove old listener before adding new one to avoid duplicates during reconnection
    consoleCharacteristic.removeEventListener("characteristicvaluechanged", handleConsoleValueChanged);
    consoleCharacteristic.addEventListener("characteristicvaluechanged", handleConsoleValueChanged);

    await consoleCharacteristic.startNotifications();

    connectedDevice = device;
    isConnected = true;
    UIManager.updateConnectionStatus("connected");
    UIManager.appendToConsole("Connected to device: " + device.name);
  }

  function handleDisconnect(event) {
    const device = event.target;
    UIManager.appendToConsole("Device disconnected: " + device.name);

    programCharacteristic = null;
    negotiatedMtuCharacteristic = null;
    consoleCharacteristic = null;
    negotiatedMTU = DEFAULT_MTU;

    if (userInitiatedDisconnect) {
      userInitiatedDisconnect = false;
      reconnectAttempts = 0;
      isConnected = false;
      UIManager.updateConnectionStatus("disconnected");
      return;
    }

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      attemptReconnect(device);
    } else {
      UIManager.appendToConsole("Max reconnection attempts reached. Please reconnect manually.");
      connectedDevice = null;
      reconnectAttempts = 0;
      isConnected = false;
      UIManager.updateConnectionStatus("disconnected");
    }
  }

  function attemptReconnect(device) {
    reconnectAttempts++;
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);

    UIManager.appendToConsole(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`);
    UIManager.updateConnectionStatus("reconnecting");

    setTimeout(async () => {
      if (userInitiatedDisconnect) {
        reconnectAttempts = 0;
        isConnected = false;
        UIManager.updateConnectionStatus("disconnected");
        return;
      }

      try {
        await connectToDevice(device);

        if (userInitiatedDisconnect) {
          UIManager.appendToConsole("Reconnect attempt was cancelled by user.");
          try {
            if (connectedDevice && connectedDevice.gatt && connectedDevice.gatt.connected) {
              connectedDevice.gatt.disconnect();
            }
          } catch (disconnectError) {
            UIManager.appendToConsole("Error while enforcing user disconnect after reconnect: " + disconnectError.message);
          }
          isConnected = false;
          reconnectAttempts = 0;
          UIManager.updateConnectionStatus("disconnected");
          return;
        }

        reconnectAttempts = 0;
        UIManager.appendToConsole("Reconnected successfully!");
      } catch (error) {
        UIManager.appendToConsole("Reconnection failed: " + error.message);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          attemptReconnect(device);
        } else {
          UIManager.appendToConsole("Max reconnection attempts reached. Please reconnect manually.");
          connectedDevice = null;
          reconnectAttempts = 0;
          isConnected = false;
          UIManager.updateConnectionStatus("disconnected");
        }
      }
    }, delay);
  }

  return {
    getServiceUUID: function() {
      return OPENBLINK_SERVICE_UUID;
    },

    isConnected: function() {
      return isConnected;
    },

    isProgramCharacteristicAvailable: function() {
      return programCharacteristic !== null;
    },

    connect: async function() {
      UIManager.appendToConsole("Connecting to device...");
      UIManager.updateConnectionStatus("connecting");
      userInitiatedDisconnect = false;
      reconnectAttempts = 0;

      try {
        const device = await navigator.bluetooth.requestDevice({
          filters: [
            { namePrefix: "OpenBlink" },
            { services: [OPENBLINK_SERVICE_UUID] },
          ],
        });

        UIManager.appendToConsole("Selected device: " + device.name);
        
        if (deviceWithDisconnectListener !== device) {
          if (deviceWithDisconnectListener) {
            deviceWithDisconnectListener.removeEventListener('gattserverdisconnected', handleDisconnect);
          }
          device.addEventListener('gattserverdisconnected', handleDisconnect);
          deviceWithDisconnectListener = device;
        }
        
        await connectToDevice(device);
      } catch (error) {
        if (error.name === 'NotFoundError') {
          UIManager.appendToConsole("Connection cancelled: No device selected");
        } else {
          UIManager.appendToConsole(ErrorHandler.getErrorMessage(error));
        }
        console.error("Error:", error);
        isConnected = false;
        UIManager.updateConnectionStatus("disconnected");
      }
    },

    disconnect: function() {
      userInitiatedDisconnect = true;
      reconnectAttempts = MAX_RECONNECT_ATTEMPTS;

      if (connectedDevice && connectedDevice.gatt.connected) {
        UIManager.appendToConsole("Disconnecting from device...");
        connectedDevice.gatt.disconnect();
      }

      programCharacteristic = null;
      negotiatedMtuCharacteristic = null;
      consoleCharacteristic = null;
      connectedDevice = null;
      negotiatedMTU = DEFAULT_MTU;
      isConnected = false;
      UIManager.updateConnectionStatus("disconnected");
      UIManager.appendToConsole("Disconnected from device.");
    },

    sendReset: async function() {
      if (!isConnected || !programCharacteristic) {
        UIManager.appendToConsole("Error: Not connected to device");
        return;
      }

      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setUint8(0, 0x01);
      view.setUint8(1, "R".charCodeAt(0));

      try {
        await programCharacteristic.writeValue(buffer);
        UIManager.appendToConsole("Send [R]eset Complete");
      } catch (error) {
        UIManager.appendToConsole("Send [R]eset Error: " + error.message);
      }
    },

    sendReload: async function() {
      if (!isConnected || !programCharacteristic) {
        UIManager.appendToConsole("Error: Not connected to device");
        return;
      }

      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setUint8(0, 0x01);
      view.setUint8(1, "L".charCodeAt(0));

      try {
        await writeCharacteristic(programCharacteristic, buffer);
        UIManager.appendToConsole("Send re[L]oad Complete");
      } catch (error) {
        UIManager.appendToConsole("Send re[L]oad Error: " + error.message);
      }
    },

    sendFirmware: async function(mrbContent, slot, onProgress) {
      if (!isConnected) {
        UIManager.appendToConsole("Error: Not connected to device");
        return;
      }

      if (!programCharacteristic) {
        UIManager.appendToConsole("Error: Program characteristic not available");
        console.error("no program characteristic");
        return;
      }

      const contentLength = mrbContent.length;
      const crc16 = crc16_reflect(0xd175, 0xffff, mrbContent);

      UIManager.appendToConsole(
        `Sending bytecode: slot=${slot}, length=${contentLength}bytes, CRC16=${crc16.toString(16)}, MTU=${negotiatedMTU}`
      );

      const DATA_PAYLOAD_SIZE = negotiatedMTU - DATA_HEADER_SIZE;
      console.log(`DATA_PAYLOAD_SIZE: ${DATA_PAYLOAD_SIZE} Bytes`);

      for (let offset = 0; offset < contentLength; offset += DATA_PAYLOAD_SIZE) {
        const chunkDataSize = Math.min(DATA_PAYLOAD_SIZE, contentLength - offset);
        const buffer = new ArrayBuffer(DATA_HEADER_SIZE + chunkDataSize);
        const view = new DataView(buffer);

        view.setUint8(0, 0x01);
        view.setUint8(1, "D".charCodeAt(0));
        view.setUint16(2, offset, true);
        view.setUint16(4, chunkDataSize, true);

        const payload = new Uint8Array(buffer, DATA_HEADER_SIZE, chunkDataSize);
        payload.set(mrbContent.subarray(offset, offset + chunkDataSize));

        try {
          await writeCharacteristic(programCharacteristic, buffer);
          UIManager.appendToConsole(
            `Send [D]ata Ok: Offset=${offset}, Size=${chunkDataSize}`
          );
          if (onProgress) {
            onProgress(offset + chunkDataSize, contentLength);
          }
        } catch (error) {
          UIManager.appendToConsole(`Send [D]ata Error: Offset=${offset}, Error: ${error.message}`);
          return;
        }
      }

      const programBuffer = new ArrayBuffer(PROGRAM_HEADER_SIZE);
      const programView = new DataView(programBuffer);

      programView.setUint8(0, 0x01);
      programView.setUint8(1, "P".charCodeAt(0));
      programView.setUint16(2, contentLength, true);
      programView.setUint16(4, crc16, true);
      programView.setUint8(6, slot);
      programView.setUint8(7, 0);

      try {
        await writeCharacteristic(programCharacteristic, programBuffer);
        UIManager.appendToConsole("Send [P]rogram Complete");
        await this.sendReload();
      } catch (error) {
        UIManager.appendToConsole("Send [P]rogram Error: " + error.message);
      }
    }
  };
})();
