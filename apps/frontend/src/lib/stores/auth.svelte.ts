import { browser } from "$app/environment";
import type { TUserData } from "$lib/types";

const LOGOUT_CHANNEL_NAME = "ocsvs-auth";

class AuthStore {
  private _user = $state<TUserData | null>(null);
  private _loading = $state<boolean>(true);
  private readonly logoutChannel: BroadcastChannel | null;

  constructor() {
    this.logoutChannel =
      browser && typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(LOGOUT_CHANNEL_NAME)
        : null;

    this.logoutChannel?.addEventListener("message", (event) => {
      if (event.data === "logout") {
        this.set({ user: null, loading: false });
      }
    });
  }

  get user() {
    return this._user?.user ?? null;
  }

  get loading() {
    return this._loading;
  }

  set(state: { user: TUserData | null; loading: boolean }) {
    this._user = state.user;
    this._loading = state.loading;
  }

  logout() {
    this.set({ user: null, loading: false });
    this.logoutChannel?.postMessage("logout");
  }
}

export const authStore = new AuthStore();
