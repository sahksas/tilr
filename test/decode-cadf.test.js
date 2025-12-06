import { describe, it, expect } from "vitest";
import { decodeCADF } from "../src/decoder/decode-cadf.js";

describe("decodeCADF", () => {
  it("should decode valid CADF binary", () => {
    // 手動でCADFバイナリを作成
    const buffer = Buffer.alloc(20);
    let offset = 0;

    // ヘッダー
    buffer.write("CADF", offset, 4, "ascii");
    offset += 4;
    buffer.writeUInt16LE(1, offset); // version
    offset += 2;
    buffer.writeUInt16LE(1, offset); // frame count
    offset += 2;

    // フレーム0（完全データ）
    buffer.writeUInt16LE(0, offset); // frame number
    offset += 2;
    buffer.writeUInt16LE(1, offset); // point count
    offset += 2;
    buffer.writeUInt16LE(100, offset); // x
    offset += 2;
    buffer.writeUInt16LE(200, offset); // y

    const frames = decodeCADF(buffer);

    expect(frames).toHaveLength(1);
    expect(frames[0].frame).toBe(0);
    expect(frames[0].coordinates).toEqual([[100, 200]]);
    expect(frames[0].totalPoints).toBe(1);
  });

  it("should throw error for invalid magic number", () => {
    const buffer = Buffer.alloc(8);
    buffer.write("XXXX", 0, 4, "ascii");

    expect(() => decodeCADF(buffer)).toThrow("Invalid differential binary format");
  });

  it("should throw error for unsupported version", () => {
    const buffer = Buffer.alloc(8);
    buffer.write("CADF", 0, 4, "ascii");
    buffer.writeUInt16LE(99, 4); // unsupported version

    expect(() => decodeCADF(buffer)).toThrow("Unsupported format version");
  });

  it("should decode differential frames correctly", () => {
    // 2フレームのCADFバイナリを作成
    const buffer = Buffer.alloc(36);
    let offset = 0;

    // ヘッダー
    buffer.write("CADF", offset, 4, "ascii");
    offset += 4;
    buffer.writeUInt16LE(1, offset); // version
    offset += 2;
    buffer.writeUInt16LE(2, offset); // frame count
    offset += 2;

    // フレーム0（完全データ）- 2ポイント
    buffer.writeUInt16LE(0, offset); // frame number
    offset += 2;
    buffer.writeUInt16LE(2, offset); // point count
    offset += 2;
    buffer.writeUInt16LE(10, offset); // x1
    offset += 2;
    buffer.writeUInt16LE(20, offset); // y1
    offset += 2;
    buffer.writeUInt16LE(30, offset); // x2
    offset += 2;
    buffer.writeUInt16LE(40, offset); // y2
    offset += 2;

    // フレーム1（差分）- インデックス1を削除、(50,60)を追加
    buffer.writeUInt16LE(1, offset); // frame number
    offset += 2;
    buffer.writeUInt16LE(1, offset); // removed count
    offset += 2;
    buffer.writeUInt16LE(1, offset); // added count
    offset += 2;
    buffer.writeUInt16LE(1, offset); // removed index
    offset += 2;
    buffer.writeUInt16LE(50, offset); // added x
    offset += 2;
    buffer.writeUInt16LE(60, offset); // added y

    const frames = decodeCADF(buffer);

    expect(frames).toHaveLength(2);
    expect(frames[0].coordinates).toEqual([[10, 20], [30, 40]]);
    expect(frames[1].coordinates).toEqual([[10, 20], [50, 60]]); // [30, 40] removed, [50, 60] added
  });

  it("should handle ArrayBuffer input", () => {
    const buffer = Buffer.alloc(20);
    buffer.write("CADF", 0, 4, "ascii");
    buffer.writeUInt16LE(1, 4);
    buffer.writeUInt16LE(1, 6);
    buffer.writeUInt16LE(0, 8);
    buffer.writeUInt16LE(1, 10);
    buffer.writeUInt16LE(5, 12);
    buffer.writeUInt16LE(10, 14);

    // ArrayBufferとして渡す
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );

    const frames = decodeCADF(arrayBuffer);

    expect(frames).toHaveLength(1);
    expect(frames[0].coordinates).toEqual([[5, 10]]);
  });
});
