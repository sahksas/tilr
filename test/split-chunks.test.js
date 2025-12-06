import { describe, it, expect } from "vitest";
import { splitIntoChunks } from "../src/pipeline/split-chunks.js";

describe("splitIntoChunks", () => {
  it("should split frames into chunks of specified size", () => {
    const frames = Array.from({ length: 150 }, (_, i) => ({
      frame: i,
      coordinates: [[i, i]],
      totalPoints: 1,
    }));

    const chunks = splitIntoChunks(frames, 60);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(60);
    expect(chunks[1]).toHaveLength(60);
    expect(chunks[2]).toHaveLength(30);
  });

  it("should handle frames less than chunk size", () => {
    const frames = Array.from({ length: 30 }, (_, i) => ({
      frame: i,
      coordinates: [],
      totalPoints: 0,
    }));

    const chunks = splitIntoChunks(frames, 60);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(30);
  });

  it("should handle empty frames array", () => {
    const chunks = splitIntoChunks([], 60);
    expect(chunks).toHaveLength(0);
  });

  it("should use default chunk size of 60", () => {
    const frames = Array.from({ length: 120 }, (_, i) => ({
      frame: i,
      coordinates: [],
      totalPoints: 0,
    }));

    const chunks = splitIntoChunks(frames);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(60);
    expect(chunks[1]).toHaveLength(60);
  });

  it("should preserve frame data integrity", () => {
    const frames = [
      { frame: 0, coordinates: [[1, 2], [3, 4]], totalPoints: 2 },
      { frame: 1, coordinates: [[5, 6]], totalPoints: 1 },
    ];

    const chunks = splitIntoChunks(frames, 1);

    expect(chunks[0][0]).toEqual(frames[0]);
    expect(chunks[1][0]).toEqual(frames[1]);
  });
});
