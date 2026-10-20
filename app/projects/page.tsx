import type { Metadata } from 'next'
import { PORTALS } from '../../public/experience/js/portals.config.js'

export const metadata: Metadata = {
  title: 'Project directory — Vibes',
  description: 'Every Vibes project in a lightweight, accessible directory. No JavaScript or WebGL required.',
}

export default function ProjectsPage() {
  const projects = PORTALS.filter(project => project.enabled !== false)
  return (
    <main className="min-h-screen bg-[#0b0712] px-6 py-16 text-[#fff3df]">
      <div className="mx-auto max-w-2xl">
        <a href="/experience/index.html?t=17" className="text-sm text-[#5fd4cf] underline underline-offset-4">Return to the listening room</a>
        <p className="mt-12 text-xs tracking-widest text-[#ffc56b]">VIBES / EVERY PROJECT</p>
        <h1 className="mt-4 font-serif text-5xl">Choose a little world.</h1>
        <p className="mt-5 leading-relaxed text-[#d8cddd]">A text-only route through every portal. No effects, no audio, no hunting.</p>
        <ul className="mt-10 divide-y divide-white/20">
          {projects.map(project => (
            <li key={project.id} className="py-6">
              <h2 className="font-serif text-2xl"><a className="underline decoration-white/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5fd4cf]" href={project.url} target="_blank" rel="noopener noreferrer">{project.title}<span className="sr-only"> (opens in a new tab)</span></a></h2>
              <p className="mt-3 text-sm leading-relaxed text-[#d8cddd]">{project.tagline}</p>
              <a className="mt-3 inline-block py-2 text-sm text-[#5fd4cf] underline underline-offset-4" href={`/experience/index.html?t=17#portal=${encodeURIComponent(project.id)}`}>Preview in the room</a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
