import './globals.css'

export const metadata = {
  title: 'Ikop - Free Online Games',
  description: 'Play free online games instantly at Ikop. No download, no login. Just play!',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6738714121307819"
          crossOrigin="anonymous"
        />
      </head>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  )
}