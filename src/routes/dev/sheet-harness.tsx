import { createFileRoute } from "@tanstack/react-router";
import DevSheetHarness from "@/pages/DevSheetHarness";
import NotFound from "@/pages/NotFound";

export const Route = createFileRoute("/dev/sheet-harness")({
  // Original App.tsx only registered this route in dev builds.
  component: () => (import.meta.env.DEV ? <DevSheetHarness /> : <NotFound />),
});
