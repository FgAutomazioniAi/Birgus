"use client";

import { History } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { LoginForm } from "@/components/organisms";
import { NexusParticles } from "@/components/landing/nexus-particles";

export function LandingPage({ version }: { version: string }) {
  const searchParams = useSearchParams();
  const [focusEmailToken, setFocusEmailToken] = useState(0);

  useEffect(() => {
    if (searchParams.get("access") === "1") setFocusEmailToken((token) => token + 1);
  }, [searchParams]);

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#07101d] text-white">
      <NexusParticles />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(13,70,103,0.34),transparent_58%)]" />
      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-md items-center justify-items-center gap-7 px-6 py-14 xl:max-w-6xl xl:grid-cols-[minmax(0,1fr)_minmax(360px,480px)] xl:justify-items-stretch xl:gap-10 xl:px-10">
        <div className="flex flex-col items-center text-center xl:items-start xl:text-left">
          <Image src="/birgus-logo/cropped/full_logo_orange.png" alt="FG Automazioni" width={220} height={220} priority className="h-auto w-[min(220px,64vw)] object-contain object-center xl:object-left" />
          <div className="mt-5 max-w-2xl">
            {/* <p className="text-sm font-semibold tracking-[0.16em] text-cyan-200">PIATTAFORMA OPERATIVA</p> */}
            {/* <h1 className="mt-5 text-4xl font-bold tracking-normal text-[#F68621] sm:text-6xl">Birgus</h1> */}
            <p className="mt-3 text-xs font-medium text-cyan-200">Versione {version}</p>
          </div>
          <div className="mt-5 flex flex-col items-stretch gap-1 sm:flex-row sm:justify-center xl:justify-start">
            <button type="button" disabled title="Disponibile con il prossimo aggiornamento" className="inline-flex h-12 cursor-not-allowed items-center justify-center gap-2 border border-slate-500/70 px-5 text-sm font-semibold text-slate-400">
              <History size={17} aria-hidden="true" />
              Changelog e versioni
            </button>
          </div>
        </div>
        <div className="w-full"><LoginForm version={version} embedded focusEmailToken={focusEmailToken} /></div>
      </section>
    </main>
  );
}
