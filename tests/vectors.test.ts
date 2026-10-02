import { describe, expect, it } from "vitest";

import { centroid, cosine, fromBytes, localEmbedding, toBytes } from "@/lib/ai/vectors";

describe("local embedding", () => {
  it("scores topical neighbours above unrelated text", () => {
    const query = localEmbedding("randonnée en montagne ce week-end");
    const near = localEmbedding("Belle randonnée à la montagne avec des amis");
    const far = localEmbedding("Nouvelle recette de gâteau au chocolat");
    expect(cosine(query, near)).toBeGreaterThan(cosine(query, far));
  });

  it("is normalised and survives a bytes round-trip", () => {
    const vector = localEmbedding("hackathon webcup 24 heures");
    expect(cosine(vector, vector)).toBeCloseTo(1, 5);
    expect(cosine(fromBytes(toBytes(vector)), vector)).toBeCloseTo(1, 5);
  });

  it("builds an interest centroid", () => {
    const profile = centroid([localEmbedding("football match"), localEmbedding("football club")]);
    expect(profile).not.toBeNull();
    expect(cosine(profile as Float32Array, localEmbedding("football"))).toBeGreaterThan(0.3);
  });
});
