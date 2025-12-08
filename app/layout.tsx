import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PDF TOC Extractor',
  description: 'Extract table of contents from course PDFs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
