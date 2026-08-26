import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import CandidateAvatar from "./candidate-avatar.svelte";

describe("CandidateAvatar component", () => {
  it("renders an img element when src is provided", () => {
    const { body } = render(CandidateAvatar, {
      props: {
        src: "https://example.com/avatar.jpg",
        alt: "Carl Yaun",
      },
    });

    expect(body).toContain("<img");
    expect(body).toContain('src="https://example.com/avatar.jpg"');
    expect(body).toContain('alt="Carl Yaun"');
    expect(body).toContain("rounded-2xl");
  });

  it("renders a Facebook-style silhouette SVG when src is null", () => {
    const { body } = render(CandidateAvatar, {
      props: {
        src: null,
        alt: "Carl Yaun",
      },
    });

    expect(body).not.toContain("<img");
    expect(body).toContain('data-testid="candidate-avatar-silhouette"');
    expect(body).toContain("<svg");
    expect(body).toContain("rounded-2xl");
  });

  it("renders a Facebook-style silhouette SVG when src is empty string", () => {
    const { body } = render(CandidateAvatar, {
      props: {
        src: "",
      },
    });

    expect(body).not.toContain("<img");
    expect(body).toContain('data-testid="candidate-avatar-silhouette"');
  });

  it("applies custom sizeClass and className", () => {
    const { body } = render(CandidateAvatar, {
      props: {
        src: null,
        sizeClass: "h-24 w-24",
        class: "custom-avatar-class",
      },
    });

    expect(body).toContain("h-24 w-24");
    expect(body).toContain("custom-avatar-class");
  });
});
