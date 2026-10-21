import type { ReactNode } from "react";
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="es"><body style={{ margin: 0, background: "#f3f5f9" }}>{children}</body></html>; }
