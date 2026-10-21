import type { ReactNode } from "react";
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="es"><body style={{fontFamily:"sans-serif",margin:40}}>{children}</body></html>; }
