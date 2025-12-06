import { describe, it, expect } from "vitest";
import { encodeChunkToCADF } from "../src/pipeline/build-binary.js";

describe("encodeChunkToCADF", () => {
  it("should encode frames to CADF binary format", () => {
    const frames = [
      { frame: 0, coordinates: [[10, 20], [30, 40]], totalPoints: 2 },
      { frame: 1, coordinates: [[10, 20], [50, 60]], totalPoints: 2 },
    ];

    const buffer = encodeChunkToCADF(frames);

    // ヘッダーを検証
    expect(buffer.toString("ascii", 0, 4)).toBe("CADF");
    expect(buffer.readUInt16LE(4)).toBe(2); // version 2
    expect(buffer.readUInt16LE(6)).toBe(2); // frame count
  });

  it("should encode first frame as complete data", () => {
    const frames = [
      { frame: 0, coordinates: [[100, 200]], totalPoints: 1 },
    ];

    const buffer = encodeChunkToCADF(frames);

    // ヘッダー後のデータ
    // Version 2: frame number (2) + point count (4) = 6 bytes header
    let offset = 8;
    expect(buffer.readUInt16LE(offset)).toBe(0); // frame number
    offset += 2;
    expect(buffer.readUInt32LE(offset)).toBe(1); // point count (UInt32)
    offset += 4;
    expect(buffer.readUInt16LE(offset)).toBe(100); // x
    offset += 2;
    expect(buffer.readUInt16LE(offset)).toBe(200); // y
  });

  it("should encode subsequent frames as differential", () => {
    const frames = [
      { frame: 0, coordinates: [[10, 20], [30, 40]], totalPoints: 2 },
      { frame: 1, coordinates: [[10, 20]], totalPoints: 1 }, // [30, 40] removed
    ];

    const buffer = encodeChunkToCADF(frames);

    // フレーム1のヘッダー位置を計算
    // ヘッダー(8) + フレーム0ヘッダー(6) + フレーム0座標(2*4=8) = 22
    let offset = 22;
    expect(buffer.readUInt16LE(offset)).toBe(1); // frame number
    offset += 2;
    expect(buffer.readUInt32LE(offset)).toBe(1); // removed count (UInt32)
    offset += 4;
    expect(buffer.readUInt32LE(offset)).toBe(0); // added count (UInt32)
  });

  it("should handle empty coordinates", () => {
    const frames = [
      { frame: 0, coordinates: [], totalPoints: 0 },
    ];

    const buffer = encodeChunkToCADF(frames);

    expect(buffer.toString("ascii", 0, 4)).toBe("CADF");
    expect(buffer.readUInt16LE(6)).toBe(1); // frame count
  });

  it("should handle added coordinates in differential frames", () => {
    const frames = [
      { frame: 0, coordinates: [[10, 20]], totalPoints: 1 },
      { frame: 1, coordinates: [[10, 20], [30, 40]], totalPoints: 2 },
    ];

    const buffer = encodeChunkToCADF(frames);

    // フレーム1を検証
    // ヘッダー(8) + フレーム0ヘッダー(6) + フレーム0座標(4) = 18
    let offset = 18;
    expect(buffer.readUInt16LE(offset)).toBe(1); // frame number
    offset += 2;
    expect(buffer.readUInt32LE(offset)).toBe(0); // removed count (UInt32)
    offset += 4;
    expect(buffer.readUInt32LE(offset)).toBe(1); // added count (UInt32)
    offset += 4;
    expect(buffer.readUInt16LE(offset)).toBe(30); // added x
    offset += 2;
    expect(buffer.readUInt16LE(offset)).toBe(40); // added y
  });
});
