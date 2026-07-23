import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import type { ObservationActor } from "../types";

let testActor: ObservationActor | null = null;

export function setObservationTestActor(actor: ObservationActor | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Observation test actors are only available in NODE_ENV=test.");
  }
  testActor = actor;
}

export async function getObservationSession(): Promise<Session | null> {
  if (process.env.NODE_ENV === "test" && testActor) {
    return {
      user: {
        id: testActor.id,
        roles: [...testActor.roles],
        name: "Observation integration actor",
        email: `${testActor.id}@integration.test`,
        image: null,
      },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as Session;
  }
  return auth();
}
