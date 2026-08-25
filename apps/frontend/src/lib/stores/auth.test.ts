import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { UserRole } from "$lib/types";

vi.mock("$app/environment", () => ({ browser: true }));

type MessageListener = (event: MessageEvent) => void;

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];

  readonly name: string;
  closed = false;
  private readonly listeners = new Set<MessageListener>();

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener): void {
    if (type === "message") this.listeners.add(listener as MessageListener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    if (type === "message") this.listeners.delete(listener as MessageListener);
  }

  close(): void {
    this.closed = true;
  }

  postMessage(data: unknown): void {
    if (this.closed) throw new DOMException("The channel is closed", "InvalidStateError");

    for (const channel of FakeBroadcastChannel.instances) {
      if (channel === this || channel.closed || channel.name !== this.name) continue;
      const event = new MessageEvent("message", { data });
      for (const listener of channel.listeners) listener(event);
    }
  }
}

let fakeWindow: EventTarget;
let authStore: (typeof import("./auth.svelte"))["authStore"];

function dispatchPageEvent(type: "pagehide" | "pageshow", persisted: boolean): void {
  const event = new Event(type);
  Object.defineProperty(event, "persisted", { value: persisted });
  fakeWindow.dispatchEvent(event);
}

beforeEach(async () => {
  vi.resetModules();
  FakeBroadcastChannel.instances = [];
  fakeWindow = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, "BroadcastChannel", {
    configurable: true,
    value: FakeBroadcastChannel,
  });

  ({ authStore } = await import("./auth.svelte"));
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "BroadcastChannel");
});

test.each([false, true])(
  "reopens the logout channel after a page return (persisted: %s)",
  (persisted) => {
    authStore.set({
      user: {
        user: {
          id: "user-1",
          email: "voter@example.com",
          username: "voter",
          role: UserRole.USER,
        },
      },
      loading: false,
    });

    const initialChannel = FakeBroadcastChannel.instances[0];
    dispatchPageEvent("pagehide", persisted);
    expect(initialChannel.closed).toBe(true);

    dispatchPageEvent("pageshow", persisted);
    const reopenedChannel = FakeBroadcastChannel.instances[1];
    expect(reopenedChannel.closed).toBe(false);

    const otherTab = new FakeBroadcastChannel("ocsvs-auth");
    otherTab.postMessage("logout");

    expect(authStore.user).toBeNull();
    expect(authStore.loading).toBe(false);
  },
);
