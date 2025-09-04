import "../styles/globals.css";
import type { AppProps } from "next/app";

// Applying Inter font
import { Inter } from "@next/font/google";
import LendStateV2 from "../context/LendStateV2";

const inter = Inter({ subsets: ["latin"] });
function MyApp({ Component, pageProps }: AppProps) {
  return (
    <main className={inter.className}>
      <LendStateV2>
        <Component {...pageProps} />
      </LendStateV2>
    </main>
  );
}

export default MyApp;
