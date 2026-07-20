"use client";

import Script from "next/script";

export default function TrustpilotWidget() {
  return (
    <>
      <Script
        src="//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
        strategy="afterInteractive"
      />
      <div
        className="trustpilot-widget"
        data-locale="en-US"
        data-template-id="56278e9abfbbba0bdcd568bc"
        data-businessunit-id="6a5d6a55105cd997a6a89909"
        data-style-height="52px"
        data-style-width="100%"
        data-token="4b73689f-ef72-41a3-b8b7-ed1fcef6c76f"
      >
        <a href="https://www.trustpilot.com/review/xpeedcarry.net" target="_blank" rel="noopener noreferrer">
          Trustpilot
        </a>
      </div>
    </>
  );
}
