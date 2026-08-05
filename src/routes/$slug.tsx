import { createFileRoute } from "@tanstack/react-router";
import PublicMenu from "@/pages/PublicMenu";
import NotFound from "@/pages/NotFound";
import { isReservedSlug } from "@/lib/publicMenuUrl";

/** Root-level restaurant menu: `/meu-restaurante`. Falls back to 404 for reserved paths. */
function RootSlugMenu() {
  const { slug } = Route.useParams();
  if (!slug || isReservedSlug(slug)) return <NotFound />;
  return <PublicMenu />;
}

export const Route = createFileRoute("/$slug")({
  component: RootSlugMenu,
});
