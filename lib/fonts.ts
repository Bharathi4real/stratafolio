import localFont from "next/font/local";

/** Self-hosted variable fonts shared by both root layouts and the global 404. */
export const bricolage = localFont({
  src: "../public/fonts/bricolage.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "75% 100%" }],
});
export const hanken = localFont({
  src: [
    { path: "../public/fonts/hanken.woff2", style: "normal" },
    { path: "../public/fonts/hanken-italic.woff2", style: "italic" },
  ],
  variable: "--font-hanken",
  weight: "100 900",
  display: "swap",
});
export const martian = localFont({
  src: "../public/fonts/martian.woff2",
  variable: "--font-martian",
  weight: "100 800",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "75% 112.5%" }],
});

/** Class list for <html>: exposes the three font variables. */
export const fontVars = `${bricolage.variable} ${hanken.variable} ${martian.variable}`;
