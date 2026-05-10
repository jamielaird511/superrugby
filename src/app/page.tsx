import SuperRugbyLoginHomeClient from "./SuperRugbyLoginHomeClient";

/** Root `/` — Super Rugby login. PaperPunter domains rewrite `/` → `/paperpunter` in middleware. */
export default function Home() {
  return <SuperRugbyLoginHomeClient />;
}
