import "../styles/globals.css";
import type { AppProps } from "next/app";

// Applying Inter font
import { Inter } from "@next/font/google";
import LendStateProduction from "../context/LendStateProduction";

const inter = Inter({ subsets: ["latin"] });
function MyApp({ Component, pageProps }: AppProps) {
  return (
    <main className={inter.className}>
      <LendStateProduction>
        <Component {...pageProps} />
      </LendStateProduction>
    </main>
  );
}

export default MyApp;
