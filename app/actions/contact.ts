"use server";

import { headers } from "next/headers";
import { Resend } from "resend";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { type ContactResult, contactSchema } from "@/lib/contact-schema";
import { readGlobal } from "@/lib/content/store";
import { DEMO } from "@/lib/demo";
import { clientIp, overLimit } from "@/lib/rate-limit";

const TOPIC_LABEL: Record<string, string> = {
  role: "Full-time role",
  freelance: "Freelance",
  collab: "Collaboration",
  hi: "Just saying hi",
};

export async function sendMessage(input: unknown): Promise<ContactResult> {
  if (DEMO) return { status: "error", message: "This is a demo site: messages aren’t sent." };
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.issues) {
      const k = String(issue.path?.[0] ?? "");
      if (k && !fields[k]) fields[k] = issue.message;
    }
    return { status: "error", message: "Please check the highlighted fields.", fields };
  }
  const { topic, name, email, message, company } = parsed.data;
  if (company) return { status: "ok" }; // honeypot: pretend success

  // Shared across instances (Postgres): 5 messages / 10 min per IP, 50 / hour site-wide so a
  // botnet can't drain the Resend quota or fill the inbox.
  const ip = clientIp(await headers());
  if (
    (await overLimit(`contact:${ip}`, 5, 10 * 60 * 1000)) ||
    (await overLimit("contact:all", 50, 60 * 60 * 1000))
  )
    return { status: "error", message: "Too many messages from here. Please try again later." };

  const settings = await readGlobal("site-settings");
  const to = process.env.CONTACT_TO_EMAIL ?? settings.email;

  try {
    await db.insert(messages).values({ topic, name, email, message });
  } catch (err) {
    console.error("contact: could not store message", err);
    return {
      status: "error",
      message: `Couldn’t send right now. Please email ${settings.email} directly.`,
    };
  }

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.CONTACT_FROM_EMAIL ?? "Portfolio <onboarding@resend.dev>",
      to,
      replyTo: email,
      subject: `Portfolio: ${TOPIC_LABEL[topic]} · ${name}`,
      text: `${message}\n\nFrom ${name} <${email}>\nTopic: ${TOPIC_LABEL[topic]}`,
    });
    // The message is already saved in the admin inbox, so an email failure isn't fatal.
    if (error) console.warn("contact: Resend failed; message kept in the admin inbox", error);
  }
  return { status: "ok" };
}
