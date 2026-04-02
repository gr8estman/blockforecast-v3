import { redirect } from "next/navigation";

// /terminal without a token → redirect to discover page
export default function TerminalIndex() {
  redirect("/");
}
