import { redirect } from "next/navigation";
import { getFirstLevel } from "@/lib/levels";

export default function PlayIndex() {
  redirect(`/play/${getFirstLevel().id}`);
}
