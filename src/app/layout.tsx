import type { Metadata } from "next";
import { JetBrains_Mono, Nunito_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const nunitoSans = Nunito_Sans({
    subsets: ["latin"],
    variable: "--font-nunito-sans",
});

const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ["latin"],
    variable: "--font-plus-jakarta-sans",
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
        icon: [{ url: "/icon", type: "image/png" }],
        shortcut: [{ url: "/icon", type: "image/png" }],
        apple: [{ url: "/icon", type: "image/png" }],
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
                className={`${nunitoSans.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
                suppressHydrationWarning
            >
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
