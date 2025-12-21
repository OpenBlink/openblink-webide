/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 */
let programCharacteristic;
let negotiatedMtuCharacteristic;
const MAX_CHUNK_SIZE = 20;
const DATA_HEADER_SIZE = 6;
const DATA_PAYLOAD_SIZE = MAX_CHUNK_SIZE - DATA_HEADER_SIZE;
const PROGRAM_HEADER_SIZE = 8;
const DEFAULT_MTU = 20;
const REQUESTED_MTU = 512;
let negotiatedMTU = DEFAULT_MTU;
const OPENBLINK_WEBIDE_VERSION = "0.3.4";

appendToConsole(`OpenBlink WebIDE v${OPENBLINK_WEBIDE_VERSION} started.`);

function appendToConsole(message) {
  if (message.trim() === "") {
    return;
  }
  const consoleOutput = document.getElementById("consoleOutput");
  const line = document.createElement("div");
  line.textContent = message;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

async function negotiateMTU() {
  const gattServer = programCharacteristic.service.device.gatt;
  if (gattServer.requestMTU) {
    try {
      negotiatedMTU = await gattServer.requestMTU(REQUESTED_MTU);
      console.log(`Negotiated MTU: ${negotiatedMTU}`);
    } catch (error) {
      console.warn(`MTU negotiation failed. Using default MTU: ${DEFAULT_MTU}`);
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
    }
    console.log(
      `MTU negotiation not supported. Using device's negotiated MTU: ${negotiatedMTU}`
    );
  }
}

async function writeCharacteristic(characteristic, buffer) {
  if (characteristic.properties.writeWithoutResponse) {
    return characteristic.writeValueWithoutResponse(buffer);
  } else {
    console.log("writeWithoutResponse がサポートされていません。");
    return characteristic.writeValue(buffer);
  }
}

async function sendReset() {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint8(0, 0x01); // version = 0x01
  view.setUint8(1, "R".charCodeAt(0)); // command = 'R'

  try {
    programCharacteristic.writeValue(buffer);
    appendToConsole("Send [R]eset Complete");
  } catch (error) {
    appendToConsole("Send [R]eset Error:", error);
  }
}

async function sendReload() {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint8(0, 0x01); // version = 0x01
  view.setUint8(1, "L".charCodeAt(0)); // command = 'L'

  try {
    await writeCharacteristic(programCharacteristic, buffer);
    appendToConsole("Send re[L]oad Complete");
  } catch (error) {
    appendToConsole("Send re[L]oad Error:", error);
  }
}

async function sendFirmware(mrbContent) {
  const contentLength = mrbContent.length;
  const crc16 = crc16_reflect(0xd175, 0xffff, mrbContent);
  const slot = 2;

  if (!programCharacteristic) {
    console.error("no program characteristic");
    return;
  }

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
      appendToConsole(`Send [D]ata Error: Offset=${offset}), Error:`, error);
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
    appendToConsole("Send [P]rogram Error:", error);
  }
}

Module.onRuntimeInitialized = () => {
  console.log("Emscripten runtime initialized.");

  const openblinkServiceUUID = "227da52c-e13a-412b-befb-ba2256bb7fbe";
  const openblinkProgramCharacteristicUUID =
    "ad9fdd56-1135-4a84-923c-ce5a244385e7";
  const openblinkConsoleCharacteristicUUID =
    "a015b3de-185a-4252-aa04-7a87d38ce148";
  const openblinkNegotiatedMtuCharacteristicUUID =
    "ca141151-3113-448b-b21a-6a6203d253ff";
  const bleConnectButton = document.getElementById("ble-connect");
  const runMainButton = document.getElementById("run-main");
  const rebootButton = document.getElementById("soft-reset");

  rebootButton.addEventListener("click", () => {
    sendReset();
  });

  bleConnectButton.addEventListener("click", () => {
    appendToConsole("Connecting to device...");
    navigator.bluetooth
      .requestDevice({
        filters: [
          { namePrefix: "OpenBlink" },
          { services: [openblinkServiceUUID] },
        ],
      })
      .then((device) => {
        appendToConsole("Selected device: " + device.name);
        return device.gatt.connect();
      })
      .then((server) => {
        console.log("Connected to GATT server");
        return server.getPrimaryService(openblinkServiceUUID);
      })
      .then((service) => {
        console.log("Got service:", service);
        return Promise.all([
          service.getCharacteristic(openblinkConsoleCharacteristicUUID),
          service.getCharacteristic(openblinkProgramCharacteristicUUID),
          service.getCharacteristic(openblinkNegotiatedMtuCharacteristicUUID),
        ]);
      })
      .then((characteristics) => {
        const consoleCharacteristic = characteristics[0];
        programCharacteristic = characteristics[1];
        negotiatedMtuCharacteristic = characteristics[2];
        console.log("Got console characteristic:", consoleCharacteristic);
        console.log("Got program characteristic:", programCharacteristic);
        console.log(
          "Got negotiatedMTU characteristic:",
          negotiatedMtuCharacteristic
        );
        negotiateMTU();

        consoleCharacteristic.addEventListener(
          "characteristicvaluechanged",
          (event) => {
            const value = new TextDecoder().decode(event.target.value);
            appendToConsole(value);
          }
        );
        return consoleCharacteristic.startNotifications();
      })
      .catch((error) => {
        console.error("Error :", error);
      });
  });

  runMainButton.addEventListener("click", () => {
    try {
      const rubyCode = editor.getValue();

      const sourceFileName = "temp.rb";
      const outputFileName = "temp.mrb";
      Module.FS.writeFile(sourceFileName, rubyCode);

      const args = ["mrbc", "-o", outputFileName, sourceFileName];
      const argc = args.length;

      const argv = Module._malloc(args.length * 4);
      const argPointers = args.map((arg) => {
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
        appendToConsole("mrbc failed with exit code:", result);
        return;
      }

      const mrbContent = Module.FS.readFile(outputFileName);

      if (!programCharacteristic) {
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
          appendToConsole("Sending bytecode Error:", error);
        });

      argPointers.forEach((ptr) => Module._free(ptr));
      Module._free(argv);
    } catch (error) {
      appendToConsole("Error:", error);
    }
  });
};
