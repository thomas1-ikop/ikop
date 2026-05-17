import './globals.css'

export const metadata = {
  title: 'Ikop - Free Online Games',
  description: 'Play free online games instantly at Ikop. No download, no login. Just play!',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  )
}