import Head from "next/head";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Ed Agent — AI Education Platform for Math &amp; Physics</title>
        <meta name="description" content="AI-powered lesson planning, question generation, and tutoring for Math and Physics — Grades 7–11." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1E3B32" />
        <meta property="og:title" content="Ed Agent — AI Education Platform for Math & Physics" />
        <meta property="og:description" content="AI lesson planning, question generation, and tutoring for Grades 7–11." />
        <meta property="og:type" content="website" />
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231E3B32'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-family='Georgia,serif' font-size='20' font-weight='bold' fill='%23C68A3D'%3EE%3C/text%3E%3C/svg%3E" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
