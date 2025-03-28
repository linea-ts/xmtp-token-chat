import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TokenTalk",
  description: "Connect with fellow memecoin/NFT holders on Linea! the fastest and cheapest zkEVM network",
  icons: [
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "shortcut icon", url: "/favicon.svg" },
    { rel: "apple-touch-icon", url: "/favicon.svg" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
