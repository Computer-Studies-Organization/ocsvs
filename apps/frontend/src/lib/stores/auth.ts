import type { TUserData } from "$lib/types";

class AuthStore {
  private _user = $state<TUserData | null>(null);
  private _loading = $state<boolean>(true);

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
}

export const authStore = new AuthStore();
