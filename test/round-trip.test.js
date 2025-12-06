import { describe, it, expect } from "vitest";
import { encodeChunkToCADF } from "../src/pipeline/build-binary.js";
import { decodeCADF } from "../src/decoder/decode-cadf.js";

describe("Round-trip encoding/decoding", () => {
  it("should decode to identical data after encode (single frame)", () => {
    const original = [
      {
        frame: 0,
        coordinates: [[10, 20], [30, 40], [50, 60]],
        totalPoints: 3,
      },
    ];

    const encoded = encodeChunkToCADF(original);
    const decoded = decodeCADF(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded[0].frame).toBe(original[0].frame);
    expect(decoded[0].coordinates).toEqual(original[0].coordinates);
    expect(decoded[0].totalPoints).toBe(original[0].totalPoints);
  });

  it("should decode to identical data after encode (multiple frames)", () => {
    const original = [
      {
        frame: 0,
        coordinates: [[10, 20], [30, 40], [50, 60]],
        totalPoints: 3,
      },
      {
        frame: 1,
        coordinates: [[10, 20], [50, 60], [70, 80]], // [30, 40] removed, [70, 80] added
        totalPoints: 3,
      },
      {
        frame: 2,
        coordinates: [[50, 60], [70, 80], [90, 100]], // [10, 20] removed, [90, 100] added
        totalPoints: 3,
      },
    ];

    const encoded = encodeChunkToCADF(original);
    const decoded = decodeCADF(encoded);

    expect(decoded).toHaveLength(3);

    for (let i = 0; i < original.length; i++) {
      expect(decoded[i].frame).toBe(original[i].frame);
      expect(decoded[i].totalPoints).toBe(original[i].totalPoints);

      // 座標をソートして比較（順序が変わる可能性があるため）
      const sortedOriginal = [...original[i].coordinates].sort(
        (a, b) => a[0] - b[0] || a[1] - b[1]
      );
      const sortedDecoded = [...decoded[i].coordinates].sort(
        (a, b) => a[0] - b[0] || a[1] - b[1]
      );
      expect(sortedDecoded).toEqual(sortedOriginal);
    }
  });

  it("should handle empty coordinates", () => {
    const original = [
      { frame: 0, coordinates: [], totalPoints: 0 },
      { frame: 1, coordinates: [[10, 20]], totalPoints: 1 },
    ];

    const encoded = encodeChunkToCADF(original);
    const decoded = decodeCADF(encoded);

    expect(decoded[0].coordinates).toEqual([]);
    expect(decoded[1].coordinates).toEqual([[10, 20]]);
  });

  it("should handle large coordinate sets", () => {
    // 1000ポイントのフレームを作成
    const coordinates = Array.from({ length: 1000 }, (_, i) => [i, i * 2]);
    const original = [
      { frame: 0, coordinates, totalPoints: 1000 },
    ];

    const encoded = encodeChunkToCADF(original);
    const decoded = decodeCADF(encoded);

    expect(decoded[0].totalPoints).toBe(1000);
    expect(decoded[0].coordinates).toHaveLength(1000);
  });

  it("should maintain frame order", () => {
    const original = Array.from({ length: 10 }, (_, i) => ({
      frame: i,
      coordinates: [[i * 10, i * 20]],
      totalPoints: 1,
    }));

    const encoded = encodeChunkToCADF(original);
    const decoded = decodeCADF(encoded);

    for (let i = 0; i < 10; i++) {
      expect(decoded[i].frame).toBe(i);
    }
  });

  it("should handle complete replacement of coordinates", () => {
    const original = [
      {
        frame: 0,
        coordinates: [[1, 1], [2, 2], [3, 3]],
        totalPoints: 3,
      },
      {
        frame: 1,
        coordinates: [[10, 10], [20, 20], [30, 30]], // 完全に異なる座標
        totalPoints: 3,
      },
    ];

    const encoded = encodeChunkToCADF(original);
    const decoded = decodeCADF(encoded);

    expect(decoded[1].totalPoints).toBe(3);

    const sortedOriginal = [...original[1].coordinates].sort(
      (a, b) => a[0] - b[0]
    );
    const sortedDecoded = [...decoded[1].coordinates].sort(
      (a, b) => a[0] - b[0]
    );
    expect(sortedDecoded).toEqual(sortedOriginal);
  });
});
