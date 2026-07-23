import { redirect } from "next/navigation";

export default function ObservationFormsPage() {
  redirect("/rubrics?tab=observation-form");
}
