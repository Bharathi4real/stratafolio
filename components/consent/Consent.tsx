"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";
import { Roll } from "@/components/ui/Pill";
import { useEscape } from "@/lib/hotkeys";
import { type ConsentChoice, setUI, storage, useUI } from "@/lib/ui-store";

const KEY = "consent.v1";

export type ConsentConfig = {
  version: number;
  ga4Id?: string | null;
  title: string;
  body: string;
  accept: string;
  reject: string;
  choose: string;
};

const privacySignal = () => {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
  return n.globalPrivacyControl === true || n.doNotTrack === "1";
};

/**
 * Consent manager. Shown only when an optional (cookie-setting) tool is configured in the
 * Privacy global, on first visit, unless GPC/DNT is on (treated as "reject optional").
 * Re-opened from the footer's "Privacy choices".
 */
export function Consent({ config, topo }: { config: ConsentConfig; topo: React.ReactNode }) {
  const open = useUI((s) => s.consentOpen);
  const menuOpen = useUI((s) => s.menuOpen);
  const consent = useUI((s) => s.consent);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const optional = Boolean(config.ga4Id);

  useEffect(() => {
    let stored: ConsentChoice | null = null;
    try {
      stored = JSON.parse(storage.get(KEY) ?? "null");
    } catch {
      stored = null;
    }
    if (stored && stored.version === config.version) {
      setUI({ consent: stored });
      setAnalytics(stored.analytics);
      return;
    }
    if (privacySignal()) {
      setUI({ consent: { version: config.version, analytics: false, timestamp: Date.now() } });
      return;
    }
    if (optional) setUI({ consentOpen: true });
  }, [config.version, optional]);

  useEffect(() => {
    if (open) setTimeout(() => cardRef.current?.focus(), 50);
  }, [open]);

  useEscape(() => setUI({ consentOpen: false }), open && !menuOpen);

  const save = (choice: { analytics: boolean }) => {
    const c: ConsentChoice = {
      version: config.version,
      analytics: choice.analytics,
      timestamp: Date.now(),
    };
    storage.set(KEY, JSON.stringify(c));
    setUI({ consent: c, consentOpen: false });
    setAnalytics(c.analytics);
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    gtag?.("consent", "update", { analytics_storage: c.analytics ? "granted" : "denied" });
    if (!c.analytics) {
      // Withdrawal: clear GA cookies we can reach.
      for (const name of document.cookie.split(";").map((s) => s.split("=")[0]?.trim() ?? ""))
        if (name.startsWith("_ga"))
          // biome-ignore lint/suspicious/noDocumentCookie: expiring third-party GA cookies on withdrawal
          document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}`;
    }
  };

  const allowGa = Boolean(config.ga4Id && consent?.analytics);

  return (
    <>
      {allowGa ? (
        <>
          <Script id="ga-consent" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});gtag('js',new Date());gtag('config','${config.ga4Id}',{anonymize_ip:true});`}
          </Script>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}`}
            strategy="afterInteractive"
          />
        </>
      ) : null}
      {open && !menuOpen ? (
        <div
          className="consent"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          ref={cardRef}
          tabIndex={-1}
        >
          {topo}
          <div className="consent-top">
            <span className="status">
              <span className="dot" aria-hidden="true" />
              <span className="status-v">Privacy</span>
            </span>
            <button
              type="button"
              className="consent-x"
              aria-label="Close"
              onClick={() => setUI({ consentOpen: false })}
            >
              ✕
            </button>
          </div>
          <h2 id={titleId} className="consent-title">
            {config.title}
          </h2>
          <p className="consent-body">
            {config.body} <Link href="/privacy">Privacy policy</Link>
          </p>
          <div className={`consent-more${expanded ? " is-open" : ""}`}>
            <div className="consent-more-inner">
              <label className="consent-row">
                <span>
                  <strong>Necessary</strong>
                  <small>Theme and this choice, stored in your browser. Always on.</small>
                </span>
                <span className="mini-switch is-on is-locked" aria-hidden="true">
                  <i />
                </span>
                <input type="checkbox" checked disabled className="sr-only" />
              </label>
              {optional ? (
                <label className="consent-row">
                  <span>
                    <strong>Analytics</strong>
                    <small>Google Analytics, to see which pages are useful.</small>
                  </span>
                  <span className={`mini-switch${analytics ? " is-on" : ""}`} aria-hidden="true">
                    <i />
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    role="switch"
                    aria-checked={analytics}
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                  />
                </label>
              ) : null}
            </div>
          </div>
          <div className="consent-actions">
            {expanded ? (
              <button
                type="button"
                className="pill pill-accent"
                onClick={() => save({ analytics })}
              >
                <Roll>Save choices</Roll>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="pill pill-ghost"
                  onClick={() => save({ analytics: true })}
                  disabled={!optional}
                >
                  <Roll>{config.accept}</Roll>
                </button>
                <button
                  type="button"
                  className="pill pill-ghost"
                  onClick={() => save({ analytics: false })}
                >
                  <Roll>{config.reject}</Roll>
                </button>
                <button
                  type="button"
                  className="consent-link"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(true)}
                >
                  {config.choose}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
