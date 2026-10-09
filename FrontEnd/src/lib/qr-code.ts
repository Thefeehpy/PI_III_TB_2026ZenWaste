const QR_VERSION = 5;
const QR_SIZE = 21 + (QR_VERSION - 1) * 4;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;
const FORMAT_MASK = 0x5412;
const FORMAT_GENERATOR = 0x537;

type QrMatrix = boolean[][];

function createMatrix(size: number, value = false) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => value));
}

function getBit(value: number, index: number) {
  return ((value >>> index) & 1) !== 0;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function bitsToBytes(bits: number[]) {
  const bytes: number[] = [];

  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;

    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | (bits[i + j] || 0);
    }

    bytes.push(value);
  }

  return bytes;
}

function multiplyGalois(x: number, y: number) {
  let z = 0;

  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }

  return z;
}

function reedSolomonGenerator(degree: number) {
  const result: number[] = Array.from({ length: degree }, (_, index) => (index === degree - 1 ? 1 : 0));
  let root = 1;

  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = multiplyGalois(result[j], root);

      if (j + 1 < result.length) {
        result[j] ^= result[j + 1];
      }
    }

    root = multiplyGalois(root, 0x02);
  }

  return result;
}

function reedSolomonRemainder(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree);
  const result = Array.from({ length: degree }, () => 0);

  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);

    generator.forEach((coefficient, index) => {
      result[index] ^= multiplyGalois(coefficient, factor || 0);
    });
  });

  return result;
}

function encodeData(text: string) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const bits: number[] = [];

  if (bytes.length > DATA_CODEWORDS - 2) {
    throw new Error("QR Code data is too long for the preview generator.");
  }

  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const data = bitsToBytes(bits);

  for (let padByte = 0xec; data.length < DATA_CODEWORDS; padByte ^= 0xfd) {
    data.push(padByte);
  }

  return data;
}

function setFunctionModule(matrix: QrMatrix, reserved: QrMatrix, x: number, y: number, isDark: boolean) {
  if (x < 0 || y < 0 || x >= QR_SIZE || y >= QR_SIZE) {
    return;
  }

  matrix[y][x] = isDark;
  reserved[y][x] = true;
}

function drawFinderPattern(matrix: QrMatrix, reserved: QrMatrix, centerX: number, centerY: number) {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(matrix, reserved, centerX + dx, centerY + dy, distance !== 2 && distance !== 4);
    }
  }
}

function drawAlignmentPattern(matrix: QrMatrix, reserved: QrMatrix, centerX: number, centerY: number) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunctionModule(matrix, reserved, centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFunctionPatterns(matrix: QrMatrix, reserved: QrMatrix) {
  drawFinderPattern(matrix, reserved, 3, 3);
  drawFinderPattern(matrix, reserved, QR_SIZE - 4, 3);
  drawFinderPattern(matrix, reserved, 3, QR_SIZE - 4);

  for (let i = 8; i < QR_SIZE - 8; i += 1) {
    setFunctionModule(matrix, reserved, 6, i, i % 2 === 0);
    setFunctionModule(matrix, reserved, i, 6, i % 2 === 0);
  }

  drawAlignmentPattern(matrix, reserved, QR_SIZE - 7, QR_SIZE - 7);
  setFunctionModule(matrix, reserved, 8, QR_VERSION * 4 + 9, true);
  reserveFormatBits(matrix, reserved);
}

function setFormatPlaceholder(matrix: QrMatrix, reserved: QrMatrix, x: number, y: number) {
  setFunctionModule(matrix, reserved, x, y, false);
}

function reserveFormatBits(matrix: QrMatrix, reserved: QrMatrix) {
  for (let i = 0; i < 15; i += 1) {
    const first =
      i < 6
        ? [8, i]
        : i < 8
          ? [8, i + 1]
          : i < 9
            ? [7, 8]
            : [14 - i, 8];
    const second = i < 8 ? [QR_SIZE - 1 - i, 8] : [8, QR_SIZE - 15 + i];

    setFormatPlaceholder(matrix, reserved, first[0], first[1]);
    setFormatPlaceholder(matrix, reserved, second[0], second[1]);
  }

  setFormatPlaceholder(matrix, reserved, 8, QR_SIZE - 8);
}

function drawFormatBits(matrix: QrMatrix, mask: number) {
  const errorCorrectionLow = 1;
  const data = (errorCorrectionLow << 3) | mask;
  let remainder = data;

  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * FORMAT_GENERATOR);
  }

  const bits = ((data << 10) | remainder) ^ FORMAT_MASK;

  for (let i = 0; i <= 5; i += 1) {
    matrix[i][8] = getBit(bits, i);
  }

  matrix[7][8] = getBit(bits, 6);
  matrix[8][8] = getBit(bits, 7);
  matrix[8][7] = getBit(bits, 8);

  for (let i = 9; i < 15; i += 1) {
    matrix[8][14 - i] = getBit(bits, i);
  }

  for (let i = 0; i < 8; i += 1) {
    matrix[8][QR_SIZE - 1 - i] = getBit(bits, i);
  }

  for (let i = 8; i < 15; i += 1) {
    matrix[QR_SIZE - 15 + i][8] = getBit(bits, i);
  }

  matrix[QR_SIZE - 8][8] = true;
}

function placeCodewords(matrix: QrMatrix, reserved: QrMatrix, codewords: number[]) {
  const bits = codewords.flatMap((byte) =>
    Array.from({ length: 8 }, (_, index) => ((byte >>> (7 - index)) & 1) !== 0),
  );
  let bitIndex = 0;
  let upward = true;

  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }

    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      const y = upward ? QR_SIZE - 1 - vertical : vertical;

      for (let horizontal = 0; horizontal < 2; horizontal += 1) {
        const x = right - horizontal;

        if (!reserved[y][x] && bitIndex < bits.length) {
          matrix[y][x] = bits[bitIndex];
          bitIndex += 1;
        }
      }
    }

    upward = !upward;
  }
}

function shouldMask(x: number, y: number, mask: number) {
  if (mask === 0) {
    return (x + y) % 2 === 0;
  }

  return false;
}

function applyMask(matrix: QrMatrix, reserved: QrMatrix, mask: number) {
  for (let y = 0; y < QR_SIZE; y += 1) {
    for (let x = 0; x < QR_SIZE; x += 1) {
      if (!reserved[y][x] && shouldMask(x, y, mask)) {
        matrix[y][x] = !matrix[y][x];
      }
    }
  }
}

export function generateQrMatrix(text: string) {
  const matrix = createMatrix(QR_SIZE);
  const reserved = createMatrix(QR_SIZE);
  const data = encodeData(text);
  const codewords = [...data, ...reedSolomonRemainder(data, ECC_CODEWORDS)];
  const mask = 0;

  drawFunctionPatterns(matrix, reserved);
  placeCodewords(matrix, reserved, codewords);
  applyMask(matrix, reserved, mask);
  drawFormatBits(matrix, mask);

  return matrix;
}
