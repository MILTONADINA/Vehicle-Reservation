/**
 * Feature 1 — User Authentication & Authorization
 * Spec: features/feature-1-user-authentication-authorization.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import axios from "axios";
import App from "../src/App.vue";
import router, { createAppRouter } from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import apiClient, { handleResponseError } from "../src/services/services.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));

const account = {
  userId: 1, email: "avery.reed@oc.edu", firstName: "Avery", lastName: "Reed", role: "requestor", areaId: null,
};
const session = { ...account, token: "app-session-token" };
const google = { initialize: vi.fn(), renderButton: vi.fn(), prompt: vi.fn() };

// The Google Identity Services callback the Login screen registers.
const credentialCallback = () => google.initialize.mock.calls.at(-1)[0].callback;

const apiError = (status, message, url) => ({ config: { url }, response: { status, data: message ? { message } : {} } });
const forbiddenAlert = (wrapper) => wrapper.find('[data-testid="forbidden-alert"]');
const homeHeading = (wrapper) => wrapper.find('[data-testid="home-heading"]');

// Every mounted App watches the shared router, so each test unmounts what it mounted.
const mounted = [];

async function mountApp(path) {
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [vuetify, router] } });
  mounted.push(wrapper);
  await flushPromises();
  return wrapper;
}

async function mountSignedIn() {
  Utils.setStore("user", session);
  AuthServices.me.mockResolvedValue({ data: account });
  return mountApp("/");
}

beforeEach(async () => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-google-client-id");
  window.google = { accounts: { id: google } };
  await router.push("/login");
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
});

describe("Feature 1 — User Authentication & Authorization", () => {
  describe("US-1.1 — Sign in with an OC Google account", () => {
    it("Google sign-in button opens the OC sign-in flow", async () => {
      const wrapper = await mountApp("/login");
      expect(wrapper.find("h1").text()).toBe("Sign in");
      expect(wrapper.find('[data-testid="google-signin"]').exists()).toBe(true);
      expect(google.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: "test-google-client-id", callback: expect.any(Function) })
      );
      expect(google.renderButton).toHaveBeenCalledOnce();
      expect(wrapper.find("input").exists()).toBe(false);
      expect(wrapper.text()).not.toMatch(/password|register|create an account/i);

      // The Google script can finish loading after the screen mounts; the button still renders.
      wrapper.unmount();
      mounted.pop();
      vi.clearAllMocks();
      delete window.google;
      const late = await mountApp("/login");
      expect(google.renderButton).not.toHaveBeenCalled();
      window.google = { accounts: { id: google } };
      window.onGoogleLibraryLoad();
      await flushPromises();
      expect(google.initialize).toHaveBeenCalledOnce();
      expect(google.renderButton).toHaveBeenCalledOnce();
      expect(late.find('[data-testid="google-signin"]').exists()).toBe(true);
      expect(late.text()).not.toContain("Google sign-in could not be loaded.");

      // If the script never arrives, the screen says so instead of showing an empty card.
      late.unmount();
      mounted.pop();
      vi.clearAllMocks();
      delete window.google;
      vi.useFakeTimers();
      try {
        const blocked = mount(App, { global: { plugins: [vuetify, router] } });
        mounted.push(blocked);
        await vi.advanceTimersByTimeAsync(0);
        expect(blocked.text()).not.toContain("Google sign-in could not be loaded.");
        await vi.advanceTimersByTimeAsync(5000);
        expect(blocked.text()).toContain("Google sign-in could not be loaded. Reload the page.");
        expect(google.renderButton).not.toHaveBeenCalled();
        expect(Utils.getStore("user")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("Successful sign-in stores the session and opens Home", async () => {
      const wrapper = await mountApp("/login");
      AuthServices.loginWithGoogle.mockResolvedValue({ data: session });
      AuthServices.me.mockResolvedValue({ data: account });
      await credentialCallback()({ credential: "google-id-token" });
      await flushPromises();
      expect(AuthServices.loginWithGoogle).toHaveBeenCalledWith({ credential: "google-id-token" });
      expect(Utils.getStore("user")).toEqual(session);
      expect(router.currentRoute.value.name).toBe("home");
      await flushPromises();
      expect(homeHeading(wrapper).text()).toBe("Vehicle Reservations");
      expect(wrapper.find('[data-testid="signed-in-email"]').text()).toBe("avery.reed@oc.edu");
      expect(wrapper.find('[data-testid="sign-out"]').text()).toBe("Sign out");
    });

    it("Cancelled Google sign-in leaves the user signed out", async () => {
      const wrapper = await mountApp("/login");
      // A closed Google prompt never delivers a credential; nothing may reach the API without one.
      credentialCallback()({});
      credentialCallback()(undefined);
      await flushPromises();
      expect(google.prompt).not.toHaveBeenCalled();
      expect(AuthServices.loginWithGoogle).not.toHaveBeenCalled();
      expect(Utils.getStore("user")).toBeNull();
      expect(router.currentRoute.value.name).toBe("login");
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Login errors are displayed without a stored session", async () => {
      const wrapper = await mountApp("/login");
      AuthServices.loginWithGoogle.mockRejectedValueOnce(apiError(403, "Use your OC Google account."));
      await credentialCallback()({ credential: "outside-token" });
      await flushPromises();
      expect(wrapper.find(".v-alert").text()).toContain("Use your OC Google account.");
      expect(Utils.getStore("user")).toBeNull();

      AuthServices.loginWithGoogle.mockRejectedValueOnce(new Error("Network Error"));
      await credentialCallback()({ credential: "another-token" });
      await flushPromises();
      expect(wrapper.find(".v-alert").text()).toContain("Sign-in could not be completed.");
      expect(Utils.getStore("user")).toBeNull();
      expect(router.currentRoute.value.name).toBe("login");

      // A 403 from the login request itself belongs to the Login screen, not the app-level Forbidden alert.
      await handleResponseError(apiError(403, "Use your OC Google account.", "login")).catch(() => {});
      await flushPromises();
      expect(forbiddenAlert(wrapper).exists()).toBe(false);
    });

    it("Repeated sign-in is blocked while a request is pending", async () => {
      const wrapper = await mountApp("/login");
      AuthServices.loginWithGoogle.mockReturnValue(new Promise(() => {}));
      credentialCallback()({ credential: "google-id-token" });
      credentialCallback()({ credential: "google-id-token" });
      await flushPromises();
      expect(AuthServices.loginWithGoogle).toHaveBeenCalledTimes(1);
      expect(wrapper.find('[data-testid="login-loading"]').exists()).toBe(true);
      expect(Utils.getStore("user")).toBeNull();
    });
  });

  describe("US-1.2 — Keep a valid application session", () => {
    it("Protected navigation validates a stored session", async () => {
      // A hard refresh of Home: the app mounts before the router has resolved its first route.
      Utils.setStore("user", session);
      let resolveReload;
      AuthServices.me.mockReturnValue(new Promise((resolve) => { resolveReload = resolve; }));
      window.history.replaceState({}, "", "/");
      const freshRouter = createAppRouter();
      const reloaded = mount(App, { global: { plugins: [vuetify, freshRouter] } });
      mounted.push(reloaded);
      await freshRouter.isReady();
      await flushPromises();
      expect(AuthServices.me).toHaveBeenCalledOnce();
      expect(homeHeading(reloaded).exists()).toBe(false);
      resolveReload({ data: account });
      await flushPromises();
      expect(homeHeading(reloaded).exists()).toBe(true);
      reloaded.unmount();
      mounted.pop();
      vi.clearAllMocks();

      Utils.setStore("user", { ...session, firstName: "Stale" });
      let resolveCheck;
      AuthServices.me.mockReturnValue(new Promise((resolve) => { resolveCheck = resolve; }));
      const wrapper = await mountApp("/");
      expect(AuthServices.me).toHaveBeenCalledOnce();
      expect(homeHeading(wrapper).exists()).toBe(false);

      resolveCheck({ data: { ...account, firstName: "Avery" } });
      await flushPromises();
      expect(homeHeading(wrapper).exists()).toBe(true);
      expect(Utils.getStore("user")).toEqual({ ...session, firstName: "Avery" });

      // A check that settles after the user has signed out must not resurrect the session.
      let settleLate;
      AuthServices.me.mockReturnValue(new Promise((resolve) => { settleLate = resolve; }));
      await router.push("/login");
      await router.push("/");
      await flushPromises();
      AuthServices.logoutUser.mockResolvedValue({ data: { message: "Signed out." } });
      await wrapper.find('[data-testid="sign-out"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("login");
      settleLate({ data: account });
      await flushPromises();
      expect(Utils.getStore("user")).toBeNull();
      expect(router.currentRoute.value.name).toBe("login");
      expect(wrapper.find("h1").text()).toBe("Sign in");

      // A check that fails after navigation must not replace the Login screen with the retry panel.
      let failLate;
      AuthServices.me.mockReturnValue(new Promise((_resolve, reject) => { failLate = reject; }));
      Utils.setStore("user", session);
      window.dispatchEvent(new CustomEvent("user-logged-in"));
      await router.push("/");
      await flushPromises();
      await wrapper.find('[data-testid="sign-out"]').trigger("click");
      await flushPromises();
      failLate(new Error("Network Error"));
      await flushPromises();
      expect(wrapper.text()).not.toContain("Session could not be checked.");
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Signed-out navigation opens Sign in", async () => {
      const wrapper = await mountApp("/");
      expect(router.currentRoute.value.name).toBe("login");
      expect(AuthServices.me).not.toHaveBeenCalled();
      expect(homeHeading(wrapper).exists()).toBe(false);
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Unauthorized API response clears local authentication", async () => {
      await mountSignedIn();
      // The real API client: the stored token travels as a Bearer header and a 401 reply ends the session.
      const transport = vi.fn(async (config) => {
        const response = { status: 401, statusText: "Unauthorized", data: { message: "Unauthorized." }, headers: {}, config };
        throw new axios.AxiosError("Request failed with status code 401", axios.AxiosError.ERR_BAD_REQUEST, config, null, response);
      });
      const previousAdapter = apiClient.defaults.adapter;
      apiClient.defaults.adapter = transport;
      try {
        await apiClient.get("auth/me").catch(() => {});
      } finally {
        apiClient.defaults.adapter = previousAdapter;
      }
      await flushPromises();
      expect(transport).toHaveBeenCalledOnce();
      expect(transport.mock.calls[0][0].headers.Authorization).toBe("Bearer app-session-token");
      expect(Utils.getStore("user")).toBeNull();
      expect(router.currentRoute.value.name).toBe("login");
    });

    it("Session check unavailable does not render protected content", async () => {
      Utils.setStore("user", session);
      AuthServices.me.mockRejectedValue(new Error("Network Error"));
      const wrapper = await mountApp("/");
      expect(wrapper.text()).toContain("Session could not be checked.");
      expect(wrapper.find('[data-testid="session-retry"]').text()).toBe("Retry");
      expect(homeHeading(wrapper).exists()).toBe(false);
      expect(Utils.getStore("user")).toEqual(session);
    });

    it("Session check retry restores protected navigation", async () => {
      Utils.setStore("user", session);
      AuthServices.me
        .mockRejectedValueOnce(apiError(500, "Session could not be checked."))
        .mockResolvedValueOnce({ data: account });
      const wrapper = await mountApp("/");
      expect(homeHeading(wrapper).exists()).toBe(false);

      await wrapper.find('[data-testid="session-retry"]').trigger("click");
      await flushPromises();
      expect(AuthServices.me).toHaveBeenCalledTimes(2);
      expect(homeHeading(wrapper).exists()).toBe(true);
      expect(wrapper.text()).not.toContain("Session could not be checked.");
    });
  });

  describe("US-1.3 — Enforce application roles", () => {
    it("Forbidden response keeps the session", async () => {
      const wrapper = await mountSignedIn();
      await handleResponseError(apiError(403, "Forbidden.", "vehicles")).catch(() => {});
      await flushPromises();
      expect(forbiddenAlert(wrapper).text()).toContain("Forbidden.");
      expect(Utils.getStore("user")).toEqual(session);
      expect(router.currentRoute.value.name).toBe("home");
      expect(homeHeading(wrapper).exists()).toBe(true);

      // The denial belongs to the screen it happened on; leaving it clears the alert.
      AuthServices.logoutUser.mockResolvedValue({ data: { message: "Signed out." } });
      await wrapper.find('[data-testid="sign-out"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("login");
      expect(forbiddenAlert(wrapper).exists()).toBe(false);
    });
  });

  describe("US-1.4 — Sign out", () => {
    it("Expired session at sign-out clears the browser", async () => {
      const wrapper = await mountSignedIn();
      AuthServices.logoutUser.mockRejectedValue(apiError(401, "Unauthorized."));
      await wrapper.find('[data-testid="sign-out"]').trigger("click");
      await flushPromises();
      expect(Utils.getStore("user")).toBeNull();
      expect(router.currentRoute.value.name).toBe("login");
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Successful sign-out clears the browser", async () => {
      const wrapper = await mountSignedIn();
      AuthServices.logoutUser.mockResolvedValue({ data: { message: "Signed out." } });
      await wrapper.find('[data-testid="sign-out"]').trigger("click");
      await flushPromises();
      expect(AuthServices.logoutUser).toHaveBeenCalledOnce();
      expect(Utils.getStore("user")).toBeNull();
      expect(router.currentRoute.value.name).toBe("login");
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Sign-out failure permits a retry", async () => {
      const wrapper = await mountSignedIn();
      AuthServices.logoutUser.mockRejectedValueOnce(apiError(500, "Sign-out could not be completed. Try again."));
      await wrapper.find('[data-testid="sign-out"]').trigger("click");
      await flushPromises();
      expect(wrapper.text()).toContain("Sign-out could not be completed. Try again.");
      expect(Utils.getStore("user")).toEqual(session);
      expect(router.currentRoute.value.name).toBe("home");

      AuthServices.logoutUser.mockRejectedValueOnce(new Error("Network Error"));
      await wrapper.find('[data-testid="sign-out"]').trigger("click");
      await flushPromises();
      expect(wrapper.text()).toContain("Sign-out could not be completed. Try again.");
      expect(Utils.getStore("user")).toEqual(session);
      expect(wrapper.find('[data-testid="sign-out"]').exists()).toBe(true);
    });
  });
});
