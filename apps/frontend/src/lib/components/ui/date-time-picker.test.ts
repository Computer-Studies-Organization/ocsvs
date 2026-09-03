import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import DateTimePicker from "./date-time-picker.svelte";

describe("DateTimePicker component", () => {
  it("renders placeholder when value is null", () => {
    const { body } = render(DateTimePicker, {
      props: {
        value: null,
        placeholder: "Pick opening time",
      },
    });

    expect(body).toContain("Pick opening time");
    expect(body).toContain('aria-haspopup="dialog"');
  });

  it("renders formatted timestamp when value is provided", () => {
    // 2026-09-02 14:30:00 UTC = 1788359400
    const testTimestamp = 1788359400;
    const { body } = render(DateTimePicker, {
      props: {
        value: testTimestamp,
      },
    });

    const expectedDateStr = new Date(testTimestamp * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    expect(body).toContain(expectedDateStr);
  });

  it("renders label and required indicator when specified", () => {
    const { body } = render(DateTimePicker, {
      props: {
        label: "Election Start Time",
        required: true,
      },
    });

    expect(body).toContain("Election Start Time");
    expect(body).toContain("*");
  });

  it("renders quick presets when provided", () => {
    const presets = [
      { label: "Right now", getTimestamp: () => 1788359400 },
      { label: "+2 hours", getTimestamp: () => 1788359400 + 7200 },
      { label: "End of Day", getTimestamp: () => 1788359400 + 14400 },
    ];

    const { body } = render(DateTimePicker, {
      props: {
        presets,
      },
    });

    expect(body).toContain("Right now");
    expect(body).toContain("+2 hours");
    expect(body).toContain("End of Day");
  });

  it("applies disabled state when disabled prop is true", () => {
    const { body } = render(DateTimePicker, {
      props: {
        disabled: true,
      },
    });

    expect(body).toContain("disabled");
  });

  it("maintains 44px min-h-11 touch targets on the main trigger button", () => {
    const { body } = render(DateTimePicker, {
      props: {
        placeholder: "Select time",
      },
    });

    expect(body).toContain("min-h-11");
  });
});
