import { useEffect, useRef } from 'react'

interface NeuronNode {
  x: number
  y: number
  vx: number
  vy: number
  baseRadius: number
  color: string
  glowColor: string
  pulsePhase: number
  isCross: boolean
}

interface SynapticPulse {
  from: number
  to: number
  progress: number
  speed: number
  color: string
  size: number
}

const MEDICAL_PALETTE = [
  { core: '#087fb5', glow: 'rgba(8, 127, 181, 0.4)' },
  { core: '#0284c7', glow: 'rgba(2, 132, 199, 0.35)' },
  { core: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.4)' },
  { core: '#06b6d4', glow: 'rgba(6, 182, 212, 0.35)' },
  { core: '#0d9488', glow: 'rgba(13, 148, 136, 0.35)' },
]

export default function MedicalNeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let animId = 0
    let width = 0
    let height = 0
    let dpr = 1

    const nodes: NeuronNode[] = []
    const pulses: SynapticPulse[] = []
    let mouse = { x: -1000, y: -1000, active: false }
    let lastPulseTime = 0

    function resize() {
      if (!canvas || !ctx) return
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      initNodes()
    }

    function initNodes() {
      nodes.length = 0
      pulses.length = 0

      // Adapter le nombre de neurones à la largeur de l'écran
      const count = Math.max(38, Math.min(65, Math.floor((width * height) / 12000)))

      for (let i = 0; i < count; i++) {
        // Légère répartition : un peu plus de densité vers le centre et la droite
        // pour laisser la zone de texte à gauche très lisible
        const x = Math.random() * width
        const y = Math.random() * height
        const p = MEDICAL_PALETTE[Math.floor(Math.random() * MEDICAL_PALETTE.length)]

        nodes.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          baseRadius: Math.random() * 2.2 + 2,
          color: p.core,
          glowColor: p.glow,
          pulsePhase: Math.random() * Math.PI * 2,
          isCross: i % 8 === 0, // Un nœud sur 8 a la forme d'une croix médicale
        })
      }
    }

    function handleMouseMove(e: MouseEvent) {
      const rect = canvas?.getBoundingClientRect()
      if (!rect) return
      mouse = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      }
    }

    function handleMouseLeave() {
      mouse.active = false
    }

    function spawnPulse() {
      if (nodes.length < 2) return
      // Trouver deux nœuds proches
      const fromIdx = Math.floor(Math.random() * nodes.length)
      const from = nodes[fromIdx]

      const candidates: number[] = []
      const maxDist = 150
      for (let j = 0; j < nodes.length; j++) {
        if (j === fromIdx) continue
        const dx = nodes[j].x - from.x
        const dy = nodes[j].y - from.y
        const dist = Math.hypot(dx, dy)
        if (dist > 30 && dist < maxDist) {
          candidates.push(j)
        }
      }

      if (candidates.length > 0) {
        const toIdx = candidates[Math.floor(Math.random() * candidates.length)]
        pulses.push({
          from: fromIdx,
          to: toIdx,
          progress: 0,
          speed: 0.012 + Math.random() * 0.016,
          color: '#38bdf8',
          size: Math.random() * 1.5 + 2,
        })
      }
    }

    function draw(timestamp: number) {
      if (!ctx || width === 0 || height === 0) return

      ctx.clearRect(0, 0, width, height)

      // Spawner régulièrement des influx synaptiques
      if (timestamp - lastPulseTime > 180 && pulses.length < 18) {
        spawnPulse()
        lastPulseTime = timestamp
      }

      const connectionDist = 145
      const mouseDist = 160

      // 1. Mettre à jour les positions des neurones
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        n.x += n.vx
        n.y += n.vy
        n.pulsePhase += 0.035

        // Rebond doux sur les bords
        if (n.x < 15) { n.x = 15; n.vx *= -1 }
        if (n.x > width - 15) { n.x = width - 15; n.vx *= -1 }
        if (n.y < 15) { n.y = 15; n.vy *= -1 }
        if (n.y > height - 15) { n.y = height - 15; n.vy *= -1 }

        // Interaction douce avec la souris
        if (mouse.active) {
          const dx = mouse.x - n.x
          const dy = mouse.y - n.y
          const d = Math.hypot(dx, dy)
          if (d < mouseDist && d > 0) {
            const force = (1 - d / mouseDist) * 0.6
            n.x -= (dx / d) * force
            n.y -= (dy / d) * force
          }
        }
      }

      // 2. Dessiner les synapses / connexions (axones)
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.hypot(dx, dy)

          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.32
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(8, 127, 181, ${alpha})`
            ctx.lineWidth = alpha > 0.18 ? 1.2 : 0.8
            ctx.stroke()
          }
        }

        // Connexion avec le curseur si actif
        if (mouse.active) {
          const dMouse = Math.hypot(mouse.x - a.x, mouse.y - a.y)
          if (dMouse < mouseDist) {
            const alpha = (1 - dMouse / mouseDist) * 0.45
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.strokeStyle = `rgba(14, 165, 233, ${alpha})`
            ctx.lineWidth = 1.3
            ctx.stroke()
          }
        }
      }

      // 3. Dessiner et mettre à jour les influx synaptiques (action potentials)
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k]
        const from = nodes[p.from]
        const to = nodes[p.to]
        if (!from || !to) {
          pulses.splice(k, 1)
          continue
        }

        p.progress += p.speed
        if (p.progress >= 1) {
          pulses.splice(k, 1)
          continue
        }

        const px = from.x + (to.x - from.x) * p.progress
        const py = from.y + (to.y - from.y) * p.progress

        // Halo lumineux de l'impulsion
        const pulseGrad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3)
        pulseGrad.addColorStop(0, 'rgba(56, 189, 248, 0.95)')
        pulseGrad.addColorStop(0.4, 'rgba(14, 165, 233, 0.55)')
        pulseGrad.addColorStop(1, 'rgba(14, 165, 233, 0)')

        ctx.fillStyle = pulseGrad
        ctx.beginPath()
        ctx.arc(px, py, p.size * 3, 0, Math.PI * 2)
        ctx.fill()

        // Point central blanc chaud
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(px, py, p.size * 0.8, 0, Math.PI * 2)
        ctx.fill()
      }

      // 4. Dessiner les neurones (somas) et leurs halos
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const currentR = n.baseRadius + Math.sin(n.pulsePhase) * 0.7

        // Halo doux pulsatile
        const haloGrad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, currentR * 3.5)
        haloGrad.addColorStop(0, n.glowColor)
        haloGrad.addColorStop(0.6, n.glowColor.replace(/[\d.]+\)$/, '0.15)'))
        haloGrad.addColorStop(1, 'rgba(8, 127, 181, 0)')

        ctx.fillStyle = haloGrad
        ctx.beginPath()
        ctx.arc(n.x, n.y, currentR * 3.5, 0, Math.PI * 2)
        ctx.fill()

        if (n.isCross) {
          // Croix médicale stylisée
          const arm = currentR * 1.5
          const thick = currentR * 0.55
          ctx.fillStyle = n.color
          ctx.fillRect(n.x - arm, n.y - thick / 2, arm * 2, thick)
          ctx.fillRect(n.x - thick / 2, n.y - arm, thick, arm * 2)
        } else {
          // Corps cellulaire rond avec noyau
          ctx.fillStyle = n.color
          ctx.beginPath()
          ctx.arc(n.x, n.y, currentR, 0, Math.PI * 2)
          ctx.fill()

          // Cœur lumineux
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(n.x - currentR * 0.25, n.y - currentR * 0.25, currentR * 0.45, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Point curseur si actif
      if (mouse.active) {
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#0284c7'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 16, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.25)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    const hostEl = canvas.parentElement
    if (hostEl) {
      hostEl.addEventListener('mousemove', handleMouseMove)
      hostEl.addEventListener('mouseleave', handleMouseLeave)
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      if (hostEl) {
        hostEl.removeEventListener('mousemove', handleMouseMove)
        hostEl.removeEventListener('mouseleave', handleMouseLeave)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="hero-neural-canvas"
      aria-hidden="true"
    />
  )
}
