import { BG_CARD, BORDER, R_CARD, R_BANNER } from "./menuTokens";

/** Bloco base do skeleton — respeita prefers-reduced-motion */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-white/[0.055] animate-pulse motion-reduce:animate-none ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonCard() {
  return (
    <div className={`flex gap-4 p-3.5 ${R_CARD} ${BG_CARD} ${BORDER}`}>
      <Bar className="w-[88px] h-[88px] rounded-2xl shrink-0" />
      <div className="flex-1 space-y-2.5 py-1">
        <Bar className="h-3.5 w-2/3 rounded-full" />
        <Bar className="h-3 w-full rounded-full" />
        <Bar className="h-3 w-4/5 rounded-full" />
        <Bar className="h-4 w-20 rounded-full mt-3" />
      </div>
    </div>
  );
}

export function SkeletonSidebar() {
  return (
    <div className="hidden lg:flex flex-col gap-5 w-[248px] shrink-0 border-r border-white/[0.06] p-5 h-[100dvh]">
      <div className="flex items-center gap-3">
        <Bar className="w-12 h-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Bar className="h-3.5 w-4/5 rounded-full" />
          <Bar className="h-2.5 w-1/2 rounded-full" />
        </div>
      </div>
      <Bar className="h-11 rounded-[14px]" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bar key={i} className="h-10 rounded-[14px]" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton completo da página, no formato final dos componentes */
export function MenuSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-[#080909] lg:flex">
      <SkeletonSidebar />
      <div className="flex-1 min-w-0">
        <Bar className="lg:hidden w-full h-52" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 lg:pt-8 space-y-5">
          <div className="lg:hidden -mt-14 relative">
            <Bar className={`h-32 ${R_BANNER}`} />
          </div>
          <Bar className="lg:hidden h-12 rounded-[14px]" />
          <div className="lg:hidden flex gap-2 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bar key={i} className="h-9 w-24 rounded-full shrink-0" />
            ))}
          </div>
          <Bar className={`hidden lg:block h-56 ${R_BANNER}`} />
          <Bar className="h-6 w-40 rounded-full" />
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Carregando cardápio</span>
    </div>
  );
}

export default MenuSkeleton;
