import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard"); // ou "/stock", "/sales"
}
