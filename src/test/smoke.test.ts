import { describe, expect, it } from "vitest";
import { makePiece, makeState, CLASSIC } from "./helpers";

describe("test infra smoke", () => {
  it("builds a state from fixtures", () => {
    const king = makePiece("white", "king", 4, 7);
    const state = makeState([king], CLASSIC);
    expect(state.currentTurn).toBe("white");
    expect(state.pieces).toHaveLength(1);
  });
});
