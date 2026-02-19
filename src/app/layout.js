import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';

export const metadata = {
  title: 'TO Wijaya Edu — Platform Ujian CBT Premium',
  description: 'Platform ujian Computer Based Testing (CBT) untuk persiapan UTBK, Try Out, dan ujian sekolah.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
