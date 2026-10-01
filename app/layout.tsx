import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = { title: "Cosmos Studio | Space education for everyone", description: "Turn NASA and space exploration topics into clear, multilingual educational videos." }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
