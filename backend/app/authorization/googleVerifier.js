import { OAuth2Client } from "google-auth-library";

/** The credential itself is bad: signature, issuer, audience, or expiry. Carries only the reason, never the token. */
export class GoogleCredentialError extends Error {}

/** Google could not be reached or the server is missing its Google client configuration. */
export class GoogleUnavailableError extends Error {}

// A bounded transport so a hung connection to Google cannot leave a login pending forever.
const client = new OAuth2Client({ transporterOptions: { timeout: 10000 } });

// google-auth-library raises transport errors (certificate download failed: DNS, TLS, 429, timeout) as
// request errors carrying a `config`, and token problems as plain errors. Only the first kind is "unavailable".
const isUnavailable = (error) =>
  error?.config !== undefined || /^Failed to retrieve verification certificates/.test(error?.message ?? "");

// Token error messages can embed the raw token after the first ": "; keep the reason only.
const reasonOf = (error) => String(error?.message ?? "Google credential rejected").split(": ")[0];

// A mutable object so tests can replace verifyIdToken without contacting Google.
export const googleVerifier = {
  async verifyIdToken(credential) {
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience) {
      throw new GoogleUnavailableError("GOOGLE_CLIENT_ID is not configured.");
    }
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience });
      return ticket.getPayload();
    } catch (error) {
      if (isUnavailable(error)) {
        throw new GoogleUnavailableError(reasonOf(error));
      }
      throw new GoogleCredentialError(reasonOf(error));
    }
  },
};
