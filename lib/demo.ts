/** Read-only demo deployments (DEMO_MODE=1): anyone can sign in and look around, nothing is saved. */
export const DEMO = process.env.DEMO_MODE === "1";

export const DEMO_MESSAGE = "This is a read-only demo: changes aren’t saved.";

/** Shown on the sign-in screen. Public by design: the account can't change anything. */
export const demoLogin = DEMO
  ? { email: process.env.DEMO_EMAIL ?? "", password: process.env.DEMO_PASSWORD ?? "" }
  : null;
