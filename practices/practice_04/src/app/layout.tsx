import type { Metadata } from "next";
import "@fontsource-variable/literata";
import "@fontsource-variable/golos-text";
import "@/styles/global.css";
export const metadata: Metadata = {
  title: "Repo Atlas — цивилизация вашего кода",
  description:
    "Исследуйте историю GitHub-репозитория на живой карте. Коммиты развивают здания, а контрибьюторы расширяют город.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
