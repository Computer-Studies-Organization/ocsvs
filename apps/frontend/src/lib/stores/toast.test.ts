import { describe, expect, it } from "vitest";
import { getToastTransition } from "./toast.svelte";

describe("getToastTransition", () => {
  it("disables motion when reduced motion is preferred", () => {
    expect(getToastTransition(true)).toEqual({ y: 0, duration: 0 });
    expect(getToastTransition(false)).toEqual({ y: -20, duration: 250 });
  });
});
