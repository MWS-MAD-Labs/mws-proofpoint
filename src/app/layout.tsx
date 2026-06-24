import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
    title: "ProofPoint Dashboard",
    description: "Performance Assessment and Review Platform",
    authors: [{ name: "ProofPoint Team" }],
    openGraph: {
        title: "ProofPoint Dashboard",
        description: "Performance Assessment and Review Platform",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
    },
    icons: {
        icon: "/favicon.svg",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    var theme = localStorage.getItem('theme');
                                    if (!theme) {
                                      theme = 'dark';
                                      localStorage.setItem('theme', 'dark');
                                    }
                                    if (theme === 'dark') {
                                        document.documentElement.classList.add('dark');
                                    } else {
                                        document.documentElement.classList.remove('dark');
                                    }
                                } catch (e) {}
                            })();
                        `,
                    }}
                />
            </head>
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
                suppressHydrationWarning
            >
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
