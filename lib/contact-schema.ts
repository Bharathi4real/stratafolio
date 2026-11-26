import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Shared by the client form (TanStack Form validators) and the Server Action. A hand-written
 * Standard Schema rather than Zod, so the public bundle doesn't ship a validation library.
 */
export const TOPICS = ["role", "freelance", "collab", "hi"] as const;

export type ContactInput = {
  topic: (typeof TOPICS)[number];
  name: string;
  email: string;
  message: string;
  company?: string;
};

// Zod's default email pattern, kept so validation is unchanged.
const EMAIL =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

type Issue = StandardSchemaV1.Issue;
type Result = { success: true; data: ContactInput } | { success: false; issues: Issue[] };

function parse(input: unknown): Result {
  const v = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const issues: Issue[] = [];
  const bad = (key: string, message: string) => issues.push({ message, path: [key] });
  const str = (key: string) => (typeof v[key] === "string" ? (v[key] as string) : null);

  const topic = str("topic");
  if (!TOPICS.includes(topic as ContactInput["topic"])) bad("topic", "Invalid option");

  const name = str("name")?.trim();
  if (name == null) bad("name", "Please add your name.");
  else if (name.length < 2) bad("name", "Please add your name.");
  else if (name.length > 80) bad("name", "That name is a bit long.");

  const email = str("email");
  if (email == null || !EMAIL.test(email)) bad("email", "That email doesn’t look right.");
  else if (email.length > 200) bad("email", "Too long: expected at most 200 characters");

  const message = str("message")?.trim();
  if (message == null || message.length < 10)
    bad("message", "A few more words, please (10+ characters).");
  else if (message.length > 4000) bad("message", "Please keep it under 4,000 characters.");

  const company = v.company;
  if (company !== undefined && (typeof company !== "string" || company.length > 0))
    bad("company", "Invalid input");

  if (issues.length) return { success: false, issues };
  return {
    success: true,
    data: {
      topic: topic as ContactInput["topic"],
      name: name as string,
      email: email as string,
      message: message as string,
      ...(company === undefined ? {} : { company: company as string }),
    },
  };
}

export const contactSchema: StandardSchemaV1<ContactInput, ContactInput> & {
  safeParse: typeof parse;
} = {
  "~standard": {
    version: 1,
    vendor: "stratafolio",
    validate: (value) => {
      const r = parse(value);
      return r.success ? { value: r.data } : { issues: r.issues };
    },
  },
  safeParse: parse,
};

export const contactDefaults: ContactInput = {
  topic: "role",
  name: "",
  email: "",
  message: "",
  company: "",
};

export type ContactResult =
  | { status: "ok" }
  | { status: "error"; message: string; fields?: Partial<Record<keyof ContactInput, string>> };
