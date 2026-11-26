import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoMark } from "@/components/ui/LogoMark";
import { StaticTopo } from "@/components/ui/Topo";
import { authMethods } from "@/lib/auth";
import { demoLogin } from "@/lib/demo";
import { getBrand } from "@/lib/queries";
import { getUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The artwork is part of the static shell; the session check and ?error= stream per request. */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const brand = await getBrand();
  const methods = {
    magicLink: authMethods.magicLink,
    google: authMethods.google,
    github: authMethods.github,
    demo: demoLogin,
  };
  return (
    <div className="login">
      <div className="login-art">
        <StaticTopo seed="admin-login" cx={720} cy={560} n={22} w={900} h={650} className="topo" />
        <span className="brand" style={{ position: "relative" }}>
          <LogoMark logo={brand.admin} />
        </span>
        <h2>
          Edit <em>everything.</em>
        </h2>
        <p className="mono" style={{ position: "relative", color: "#a8a49b" }}>
          {brand.adminTitle}
        </p>
      </div>
      <Suspense fallback={<LoginForm {...methods} />}>
        <LoginGate searchParams={searchParams} methods={methods} />
      </Suspense>
    </div>
  );
}

async function LoginGate({
  searchParams,
  methods,
}: {
  searchParams: SearchParams;
  methods: {
    magicLink: boolean;
    google: boolean;
    github: boolean;
    demo: { email: string; password: string } | null;
  };
}) {
  if (await getUser()) redirect("/admin");
  const raw = (await searchParams).error;
  const error = Array.isArray(raw) ? raw[0] : raw;
  return <LoginForm {...methods} error={error} />;
}
