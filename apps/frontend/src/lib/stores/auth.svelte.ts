import { browser } from "$app/environment";
import type { TUserData } from "$lib/types";

const LOGOUT_CHANNEL_NAME = "ocsvs-auth";
type AuthTransitionListener = () => void;

const authTransitionListeners = new Set<AuthTransitionListener>();

export function onAuthTransition(listener: AuthTransitionListener): () => void {
  authTransitionListeners.add(listener);
  return () => {
    authTransitionListeners.delete(listener);
  };
}

function notifyAuthTransition(): void {
  for (const listener of authTransitionListeners) listener();
}

class AuthStore {
  private _user = $state<TUserData | null>(null);
  private _loading = $state<boolean>(true);
  private logoutChannel: BroadcastChannel | null = null;

  constructor() {
    this.initChannel();

    if (browser && typeof window !== "undefined") {
      window.addEventListener("pagehide", () => {
        this.closeChannel();
      });
      window.addEventListener("pageshow", () => {
        this.initChannel();
      });
    }
  }

  private initChannel() {
    if (this.logoutChannel) return;
    if (browser && typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      this.logoutChannel = new BroadcastChannel(LOGOUT_CHANNEL_NAME);
      this.logoutChannel.addEventListener("message", (event) => {
        if (event.data === "logout") {
          this.set({ user: null, loading: false }, { forceCacheInvalidation: true });
        }
      });
    }
  }

  private closeChannel() {
    if (this.logoutChannel) {
      this.logoutChannel.close();
      this.logoutChannel = null;
    }
  }

  get user() {
    return this._user?.user ?? null;
  }

  get loading() {
    return this._loading;
  }

  set(
    state: { user: TUserData | null; loading: boolean },
    options: { forceCacheInvalidation?: boolean } = {},
  ) {
    const previousUser = this._user?.user;
    const nextUser = state.user?.user;
    const identityChanged =
      previousUser?.id !== nextUser?.id || previousUser?.role !== nextUser?.role;

    this._user = state.user;
    this._loading = state.loading;

    if (identityChanged || options.forceCacheInvalidation) notifyAuthTransition();
  }

  logout() {
    this.set({ user: null, loading: false }, { forceCacheInvalidation: true });
    this.logoutChannel?.postMessage("logout");
  }
}

export const authStore = new AuthStore();
