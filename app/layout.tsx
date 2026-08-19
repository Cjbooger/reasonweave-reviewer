import type { Metadata, Viewport } from "next";
import "./globals.css";

function resolveMetadataBase(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercelHost = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  )?.trim();

  if (configuredUrl) {
    return new URL(configuredUrl);
  }

  if (vercelHost) {
    return new URL(`https://${vercelHost}`);
  }

  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "ReasonWeave — Make your reasoning visible",
  description:
    "A source-backed inquiry studio where learners predict, judge evidence, create, reflect, and leave with a visible reasoning trace.",
  applicationName: "ReasonWeave",
  keywords: [
    "education",
    "curiosity",
    "learning",
    "OpenAI",
    "GPT-5.6",
    "evidence literacy",
  ],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    title: "ReasonWeave — Make your reasoning visible",
    description:
      "A source-backed inquiry studio where learners predict, judge evidence, create, reflect, and leave with a visible reasoning trace.",
    images: [
      {
        url: "/reasonweave-og.png",
        width: 1280,
        height: 720,
        alt: "ReasonWeave turns one learner question into a prediction-first inquiry and learner-owned reasoning trace.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReasonWeave — Make your reasoning visible",
    description:
      "Most AI gives you an answer. ReasonWeave makes your thinking visible.",
    images: ["/reasonweave-og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f0e7",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
