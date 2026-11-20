export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startObservationAcknowledgementScheduler } = await import(
      "./features/observations/server/observationAcknowledgementScheduler"
    );
    startObservationAcknowledgementScheduler();
    const { startCentralSyncScheduler } = await import("./lib/central-sync");
    startCentralSyncScheduler();
  }
}
