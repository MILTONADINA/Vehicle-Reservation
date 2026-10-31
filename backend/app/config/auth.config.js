const authConfig = {
  // JWT signing secret. No built-in fallback: without AUTH_SECRET no session can be issued or verified.
  secret: process.env.AUTH_SECRET,
  // Google hosted domains and email domains allowed to sign in or be seeded as admin.
  approvedDomains: ["oc.edu", "eagles.oc.edu"],
};

export default authConfig;
