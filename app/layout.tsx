import type { ReactNode } from 'react';
import '../styles/global.scss';

export const metadata = {
  title: 'Atlas Vivo',
  description: 'Mapa com rotas paralelas e interceptadas no Next.js',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura, para não piscar */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('mapa:theme');if(t==='noite'||t==='dia')document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
