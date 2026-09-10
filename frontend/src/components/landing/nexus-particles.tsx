"use client";

import { Particles, ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { useMemo } from "react";

export function NexusParticles() {
  const options = useMemo(() => ({
    fullScreen: { enable: false },
    background: { color: "transparent" },
    fpsLimit: 60,
    detectRetina: true,
    interactivity: {
      events: {
        onClick: { enable: false },
        onHover: { enable: false },
        resize: { enable: true },
      },
    },
    particles: {
      color: { value: ["#00f0ff", "#71f7ff", "#6ec8ff"] },
      links: {
        enable: true,
        color: "#00f0ff",
        distance: 120,
        opacity: 0.22,
        width: 1,
        shadow: { enable: true, color: "#00f0ff", blur: 5 },
      },
      move: {
        enable: true,
        direction: "none" as const,
        outModes: { default: "bounce" as const },
        speed: 0.6,
        straight: false,
      },
      number: { density: { enable: true, width: 640, height: 160 }, value: 25 },
      opacity: { value: { min: 0.22, max: 0.88 }, animation: { enable: true, speed: 0.45, sync: false } },
      shape: { type: "circle" },
      size: { value: { min: 1.4, max: 3.8 } },
    },
    pauseOnBlur: true,
    pauseOnOutsideViewport: true,
  }), []);

  return (
    <ParticlesProvider init={loadSlim}>
      <Particles id="birgus-nexus-particles" className="absolute inset-0" options={options} />
    </ParticlesProvider>
  );
}
