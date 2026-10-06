/**
 * Made with 💛 by Karim Saif
 * Created and customized for Framer by Karim Saif
 *
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */

"use client"

import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { useEffect, useRef } from "react"

export interface KarimSaifBrickCatsProps {
    backgroundColor?: string
    bodyColor?: string
    coolColor1?: string
    coolColor2?: string
    coolColor3?: string
    warmColor1?: string
    warmColor2?: string
    eyeColor?: string
    glowColor?: string
    studSize?: number
    catDensity?: number
    speed?: number
    hoverStrength?: number
    showHoverGlow?: boolean
    brickDrop?: boolean
    paused?: boolean
}

const STEP = 1 / 8
const DROP_DURATION = 0.16
const MAX_BRICK = 4
const MAX_DPR = 2

const hash = (x: number, y: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
    return value - Math.floor(value)
}

interface Cat {
    x: number
    y: number
    r: number
    phase: number
    sx: number
    sy: number
    ox: number
    oy: number
    stride: number
}

interface Part {
    x: number
    y: number
    r: number
}

export default function KarimSaifBrickCats({
    backgroundColor = "#1f1f21",
    bodyColor = "#0d0d0e",
    coolColor1 = "#8a6cff",
    coolColor2 = "#5b3de8",
    coolColor3 = "#4128d4",
    warmColor1 = "#d2123d",
    warmColor2 = "#ef7a10",
    eyeColor = "#d8d8d8",
    glowColor = "#4a4a52",
    studSize = 18,
    catDensity = 1,
    speed = 1,
    hoverStrength = 1,
    showHoverGlow = true,
    brickDrop = true,
    paused = false,
}: KarimSaifBrickCatsProps) {
    const hostRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isStaticRenderer = useIsStaticRenderer()

    const settingsRef = useRef({
        speed,
        hoverStrength,
        showHoverGlow,
        brickDrop,
        paused,
    })

    settingsRef.current = {
        speed,
        hoverStrength,
        showHoverGlow,
        brickDrop,
        paused,
    }

    useEffect(() => {
        const host = hostRef.current
        const canvas = canvasRef.current

        if (!host || !canvas) return

        const ctx = canvas.getContext("2d", {
            alpha: true,
            desynchronized: true,
        })

        if (!ctx) return

        const reducedMotionQuery = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        )

        const cell = Number.isFinite(studSize)
            ? Math.max(10, Math.min(48, Math.round(studSize)))
            : 18

        const density = Number.isFinite(catDensity)
            ? Math.max(0.35, Math.min(2, catDensity))
            : 1

        const palette = [
            backgroundColor,
            bodyColor,
            eyeColor,
            coolColor1,
            coolColor2,
            coolColor3,
            warmColor1,
            warmColor2,
        ]

        const coolStart = 3
        const warmStart = 6
        const coolCount = 3
        const warmCount = 2

        let width = 0
        let height = 0
        let dpr = 1
        let columns = 0
        let rows = 0

        let grid = new Uint8Array(0)
        let nextGrid = new Uint8Array(0)
        let joins = new Uint8Array(0)
        let droppedAt = new Float32Array(0)
        let field = new Float32Array(0)

        let sprites: HTMLCanvasElement[][] = []
        let plateLayer: HTMLCanvasElement | null = null
        let plateSprite: HTMLCanvasElement | null = null
        let glowSprite: HTMLCanvasElement | null = null

        let cats: Cat[] = []

        let animationFrame = 0
        let previousTime = 0
        let elapsed = 0
        let lastStep = -Infinity
        let visible = false
        let initialized = false

        const pointer = {
            x: 0,
            y: 0,
            strength: 0,
            target: 0,
        }

        const drawStud = (
            context: CanvasRenderingContext2D,
            size: number,
            color: string
        ) => {
            const center = size * 0.5
            const radius = size * 0.3

            context.fillStyle = "rgba(0,0,0,0.4)"
            context.beginPath()
            context.arc(
                center + size * 0.05,
                center + size * 0.07,
                radius,
                0,
                Math.PI * 2
            )
            context.fill()

            context.fillStyle = color
            context.beginPath()
            context.arc(center, center, radius, 0, Math.PI * 2)
            context.fill()

            const shine = context.createLinearGradient(
                center - radius,
                center - radius,
                center + radius,
                center + radius
            )

            shine.addColorStop(0, "rgba(255,255,255,0.28)")
            shine.addColorStop(0.45, "rgba(255,255,255,0)")
            shine.addColorStop(1, "rgba(0,0,0,0.25)")

            context.fillStyle = shine
            context.beginPath()
            context.arc(center, center, radius, 0, Math.PI * 2)
            context.fill()
        }

        const makeBrick = (
            color: string,
            joinLeft: boolean,
            joinRight: boolean
        ) => {
            const size = Math.max(1, Math.round(cell * dpr))
            const sprite = document.createElement("canvas")

            sprite.width = size
            sprite.height = size

            const context = sprite.getContext("2d")

            if (!context) return sprite

            const edge = Math.max(1, Math.round(size * 0.07))

            context.fillStyle = color
            context.fillRect(0, 0, size, size)

            context.fillStyle = "rgba(255,255,255,0.12)"
            context.fillRect(0, 0, size, edge)

            if (!joinLeft) {
                context.fillRect(0, 0, edge, size)
            }

            context.fillStyle = "rgba(0,0,0,0.32)"
            context.fillRect(0, size - edge, size, edge)

            if (!joinRight) {
                context.fillRect(size - edge, 0, edge, size)
            }

            drawStud(context, size, color)

            return sprite
        }

        const makePlate = (color: string) => {
            const size = Math.max(1, Math.round(cell * dpr))
            const sprite = document.createElement("canvas")

            sprite.width = size
            sprite.height = size

            const context = sprite.getContext("2d")

            if (!context) return sprite

            context.fillStyle = color
            context.fillRect(0, 0, size, size)

            drawStud(context, size, color)

            return sprite
        }

        const buildPlateLayer = () => {
            if (!plateSprite || width <= 0 || height <= 0) {
                plateLayer = null
                return
            }

            const layer = document.createElement("canvas")

            layer.width = canvas.width
            layer.height = canvas.height

            const layerContext = layer.getContext("2d")

            if (!layerContext) {
                plateLayer = null
                return
            }

            layerContext.imageSmoothingEnabled = true

            const size = cell * dpr

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < columns; x++) {
                    layerContext.drawImage(
                        plateSprite,
                        Math.round(x * size),
                        Math.round(y * size)
                    )
                }
            }

            plateLayer = layer
        }

        const spawn = () => {
            const targetArea = 420 / density
            const across = Math.max(1, Math.round(width / targetArea))
            const down = Math.max(1, Math.round(height / targetArea))

            cats = Array.from(
                {
                    length: across * down,
                },
                (_, index) => ({
                    x:
                        ((index % across) + 0.5 + (Math.random() - 0.5) * 0.3) /
                        across,
                    y:
                        (Math.floor(index / across) +
                            0.5 +
                            (Math.random() - 0.5) * 0.3) /
                        down,
                    r: 0.75 + Math.random() * 0.3,
                    phase: index * 1.7 + Math.random() * 6,
                    sx: 0.35 + Math.random() * 0.4,
                    sy: 0.3 + Math.random() * 0.4,
                    ox: 0,
                    oy: 0,
                    stride: 0,
                })
            )
        }

        const catBase = () => {
            const targetArea = 420 / density
            const across = Math.max(1, Math.round(width / targetArea))
            const down = Math.max(1, Math.round(height / targetArea))

            return (Math.min(width / across, height / down) / cell) * 0.29
        }

        const homeOf = (cat: Cat, time: number) => ({
            x:
                (cat.x + 0.1 * Math.sin(time * 0.13 * cat.sx + cat.phase)) *
                columns,
            y:
                (cat.y +
                    0.08 * Math.cos(time * 0.11 * cat.sy + cat.phase * 1.3)) *
                rows,
        })

        const steer = (dt: number) => {
            if (cats.length === 0) return

            const settings = settingsRef.current
            const hover = Number.isFinite(settings.hoverStrength)
                ? Math.max(0, Math.min(2, settings.hoverStrength))
                : 1

            const base = catBase()

            let nearest = -1
            let nearestDistance = Infinity

            for (let index = 0; index < cats.length; index++) {
                const cat = cats[index]
                const home = homeOf(cat, elapsed)

                const distance = Math.hypot(
                    pointer.x - home.x,
                    pointer.y - home.y
                )

                if (distance < nearestDistance) {
                    nearestDistance = distance
                    nearest = index
                }
            }

            for (let index = 0; index < cats.length; index++) {
                const cat = cats[index]
                const home = homeOf(cat, elapsed)

                const pull =
                    pointer.strength * hover * (index === nearest ? 0.85 : 0.12)

                let targetX = (pointer.x - home.x) * pull
                let targetY =
                    (pointer.y + cat.r * base * 0.4 - home.y) * pull

                const reach = cat.r * base * 1.6
                const length = Math.hypot(targetX, targetY)

                if (length > reach) {
                    targetX *= reach / length
                    targetY *= reach / length
                }

                const easing = Math.min(1, dt * 2.2)
                const oldX = cat.ox
                const oldY = cat.oy

                cat.ox += (targetX - cat.ox) * easing
                cat.oy += (targetY - cat.oy) * easing

                const movement = Math.hypot(cat.ox - oldX, cat.oy - oldY)

                cat.stride += dt * 0.9 + movement * 2.2
            }
        }

        const buildParts = () => {
            const base = catBase()
            const centers: Part[] = new Array(cats.length)

            for (let index = 0; index < cats.length; index++) {
                const cat = cats[index]
                const home = homeOf(cat, elapsed)

                centers[index] = {
                    x: home.x + cat.ox,
                    y: home.y + cat.oy,
                    r: cat.r * base,
                }
            }

            const parts: Part[] = []

            for (let index = 0; index < centers.length; index++) {
                const center = centers[index]

                const touched =
                    pointer.strength > 0.5 &&
                    Math.hypot(
                        pointer.x - center.x,
                        (pointer.y - center.y) * 1.1
                    ) <
                        center.r * 1.1

                const ear = touched ? 1.25 : 1.05
                const wiggle = Math.sin(cats[index].stride * 2.4) * 0.12

                parts.push(
                    center,
                    {
                        x: center.x - center.r * 0.55,
                        y: center.y - center.r * (ear + wiggle * 0.3),
                        r: center.r * 0.45,
                    },
                    {
                        x: center.x + center.r * 0.55,
                        y: center.y - center.r * (ear - wiggle * 0.3),
                        r: center.r * 0.45,
                    },
                    {
                        x: center.x - center.r * 0.5,
                        y: center.y + center.r * (0.95 + wiggle),
                        r: center.r * 0.3,
                    },
                    {
                        x: center.x + center.r * 0.5,
                        y: center.y + center.r * (0.95 - wiggle),
                        r: center.r * 0.3,
                    }
                )
            }

            return {
                centers,
                parts,
            }
        }

        const layout = () => {
            if (columns <= 0 || rows <= 0) {
                return
            }

            const { centers, parts } = buildParts()
            const total = columns * rows

            if (field.length !== total) {
                field = new Float32Array(total)
            } else {
                field.fill(0)
            }

            if (nextGrid.length !== total) {
                nextGrid = new Uint8Array(total)
            } else {
                nextGrid.fill(0)
            }

            for (let partIndex = 0; partIndex < parts.length; partIndex++) {
                const part = parts[partIndex]
                const influenceRadius = Math.max(2, part.r * 1.9 + 1)

                const minX = Math.max(0, Math.floor(part.x - influenceRadius))
                const maxX = Math.min(
                    columns - 1,
                    Math.ceil(part.x + influenceRadius)
                )

                const minY = Math.max(0, Math.floor(part.y - influenceRadius))
                const maxY = Math.min(
                    rows - 1,
                    Math.ceil(part.y + influenceRadius)
                )

                const radiusSquared = influenceRadius * influenceRadius
                const partRadiusSquared = part.r * part.r

                for (let y = minY; y <= maxY; y++) {
                    const rowOffset = y * columns

                    for (let x = minX; x <= maxX; x++) {
                        const dx = x + 0.5 - part.x
                        const dy = (y + 0.5 - part.y) * 1.1
                        const distanceSquared = dx * dx + dy * dy

                        if (distanceSquared > radiusSquared) {
                            continue
                        }

                        const k = partRadiusSquared / (distanceSquared + 1)

                        field[rowOffset + x] += k * k
                    }
                }
            }

            const inside = (x: number, y: number) =>
                x >= 0 &&
                y >= 0 &&
                x < columns &&
                y < rows &&
                field[y * columns + x] > 1

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < columns; x++) {
                    const index = y * columns + x
                    const here = inside(x, y)

                    const edge =
                        here &&
                        (!inside(x - 1, y) ||
                            !inside(x + 1, y) ||
                            !inside(x, y - 1) ||
                            !inside(x, y + 1))

                    const rim =
                        !here &&
                        (inside(x - 1, y) ||
                            inside(x + 1, y) ||
                            inside(x, y - 1) ||
                            inside(x, y + 1)) &&
                        hash(x, y) < 0.45

                    if (!edge && !rim) {
                        nextGrid[index] = here ? 1 : 0
                        continue
                    }

                    const gx =
                        (x + 1 < columns ? field[index + 1] : 0) -
                        (x > 0 ? field[index - 1] : 0)

                    const facesLeft =
                        Math.abs(gx) > 0.05 ? gx > 0 : hash(y, x) < 0.5

                    const value = hash(x * 3.1, y * 1.7)

                    if (facesLeft) {
                        nextGrid[index] =
                            coolStart +
                            (Math.floor(value * coolCount) % coolCount)
                    } else {
                        nextGrid[index] =
                            warmStart +
                            (rim
                                ? warmCount - 1
                                : Math.floor(value * warmCount) % warmCount)
                    }
                }
            }

            for (let catIndex = 0; catIndex < centers.length; catIndex++) {
                const center = centers[catIndex]
                const cat = cats[catIndex]

                const touched =
                    pointer.strength > 0.5 &&
                    Math.hypot(
                        pointer.x - center.x,
                        (pointer.y - center.y) * 1.1
                    ) <
                        center.r * 1.1

                const blink =
                    Math.sin(elapsed * 0.7 + cat.phase * 3) > 0.985

                if (blink) continue

                const looking = pointer.strength > 0.5

                const lookX = looking
                    ? Math.max(
                          -1,
                          Math.min(
                              1,
                              Math.round(
                                  (pointer.x - center.x) / (center.r * 0.6)
                              )
                          )
                      )
                    : 0

                const lookY =
                    looking &&
                    Math.abs(pointer.y - center.y) > center.r * 0.6
                        ? Math.sign(pointer.y - center.y)
                        : 0

                const eyeY =
                    Math.round(center.y - center.r * 0.25) + lookY

                for (const side of [-1, 1]) {
                    const eyeX =
                        Math.round(center.x + side * center.r * 0.3) + lookX

                    const cells = touched
                        ? [
                              [eyeX - 1, eyeY + 1],
                              [eyeX, eyeY + 1],
                          ]
                        : [
                              [eyeX, eyeY],
                              [eyeX, eyeY + 1],
                          ]

                    for (
                        let cellIndex = 0;
                        cellIndex < cells.length;
                        cellIndex++
                    ) {
                        const x = cells[cellIndex][0]
                        const y = cells[cellIndex][1]

                        if (x < 0 || y < 0 || x >= columns || y >= rows) {
                            continue
                        }

                        const index = y * columns + x

                        if (nextGrid[index] === 1) {
                            nextGrid[index] = 2
                        }
                    }
                }
            }

            const useDrop = settingsRef.current.brickDrop

            for (let index = 0; index < total; index++) {
                if (nextGrid[index] !== grid[index]) {
                    if (nextGrid[index] !== 0 && useDrop) {
                        droppedAt[index] = elapsed
                    }

                    grid[index] = nextGrid[index]
                }
            }

            joins.fill(0)

            for (let y = 0; y < rows; y++) {
                let run = 0

                for (let x = 0; x < columns; x++) {
                    const index = y * columns + x
                    const kind = grid[index]

                    const continues =
                        x > 0 &&
                        kind !== 0 &&
                        kind !== 2 &&
                        grid[index - 1] === kind &&
                        grid[index - 1] !== 2 &&
                        run < MAX_BRICK &&
                        hash(x * 7.3, y * 2.9) > 0.3

                    if (continues) {
                        joins[index] |= 1
                        joins[index - 1] |= 2
                        run++
                    } else {
                        run = kind === 0 ? 0 : 1
                    }
                }
            }
        }

        const draw = () => {
            if (!plateLayer || columns <= 0 || rows <= 0) {
                return
            }

            const size = cell * dpr

            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.globalAlpha = 1
            ctx.drawImage(plateLayer, 0, 0)

            const settings = settingsRef.current

            if (
                settings.showHoverGlow &&
                pointer.strength > 0.01 &&
                glowSprite
            ) {
                const radius = 3.2
                const minX = Math.max(0, Math.floor(pointer.x - radius))
                const maxX = Math.min(
                    columns - 1,
                    Math.ceil(pointer.x + radius)
                )

                const minY = Math.max(0, Math.floor(pointer.y - radius))
                const maxY = Math.min(rows - 1, Math.ceil(pointer.y + radius))

                for (let y = minY; y <= maxY; y++) {
                    for (let x = minX; x <= maxX; x++) {
                        const distance = Math.hypot(
                            x + 0.5 - pointer.x,
                            y + 0.5 - pointer.y
                        )

                        if (distance > radius) {
                            continue
                        }

                        ctx.globalAlpha =
                            pointer.strength * (1 - distance / radius) * 0.55

                        ctx.drawImage(
                            glowSprite,
                            Math.round(x * size),
                            Math.round(y * size)
                        )
                    }
                }

                ctx.globalAlpha = 1
            }

            const shadow = Math.max(1, Math.round(size * 0.14))

            ctx.fillStyle = "rgba(0,0,0,0.45)"

            for (let index = 0; index < grid.length; index++) {
                const kind = grid[index]

                if (kind === 0 || kind === 2) {
                    continue
                }

                const x = index % columns
                const y = Math.floor(index / columns)

                ctx.fillRect(
                    Math.round(x * size) + shadow,
                    Math.round(y * size) + shadow,
                    Math.ceil(size),
                    Math.ceil(size)
                )
            }

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < columns; x++) {
                    const index = y * columns + x
                    const kind = grid[index]

                    if (kind === 0) {
                        continue
                    }

                    const sprite = sprites[kind]?.[joins[index]]

                    if (!sprite) {
                        continue
                    }

                    const settings = settingsRef.current

                    const progress = settings.brickDrop
                        ? Math.min(
                              1,
                              Math.max(
                                  0,
                                  (elapsed - droppedAt[index]) / DROP_DURATION
                              )
                          )
                        : 1

                    const px = Math.round(x * size)
                    const py = Math.round(y * size)

                    if (progress >= 1) {
                        ctx.drawImage(sprite, px, py)
                        continue
                    }

                    const lift = (1 - progress) * (1 - progress)
                    const scale = 1 + 0.25 * lift
                    const drawn = size * scale

                    ctx.globalAlpha = 0.35 + 0.65 * progress
                    ctx.drawImage(
                        sprite,
                        px - (drawn - size) / 2,
                        py - (drawn - size) / 2 - lift * size * 0.3,
                        drawn,
                        drawn
                    )
                    ctx.globalAlpha = 1
                }
            }
        }

        const tick = (now: number) => {
            const settings = settingsRef.current

            const currentSpeed = Number.isFinite(settings.speed)
                ? Math.max(0, Math.min(3, settings.speed))
                : 1

            if (
                isStaticRenderer ||
                reducedMotionQuery.matches ||
                settings.paused ||
                currentSpeed <= 0 ||
                !visible ||
                document.hidden
            ) {
                animationFrame = 0
                return
            }

            const dt =
                Math.min((now - previousTime) / 1000, 0.1) * currentSpeed

            elapsed += dt
            previousTime = now

            pointer.strength +=
                (pointer.target - pointer.strength) * 0.12

            steer(dt)

            if (elapsed - lastStep >= STEP) {
                lastStep = elapsed
                layout()
            }

            draw()

            animationFrame = requestAnimationFrame(tick)
        }

        const updateAnimation = () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame)
                animationFrame = 0
            }

            draw()

            const settings = settingsRef.current

            const currentSpeed = Number.isFinite(settings.speed)
                ? Math.max(0, Math.min(3, settings.speed))
                : 1

            const disabled =
                isStaticRenderer ||
                reducedMotionQuery.matches ||
                settings.paused ||
                currentSpeed <= 0 ||
                !visible ||
                document.hidden

            if (disabled) {
                return
            }

            previousTime = performance.now()
            animationFrame = requestAnimationFrame(tick)
        }

        const resize = () => {
            width = host.clientWidth
            height = host.clientHeight

            if (width <= 0 || height <= 0) {
                return
            }

            dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)

            canvas.width = Math.max(1, Math.floor(width * dpr))
            canvas.height = Math.max(1, Math.floor(height * dpr))

            columns = Math.max(1, Math.ceil(width / cell))
            rows = Math.max(1, Math.ceil(height / cell))

            const total = columns * rows

            grid = new Uint8Array(total)
            nextGrid = new Uint8Array(total)
            joins = new Uint8Array(total)
            droppedAt = new Float32Array(total)
            droppedAt.fill(-Infinity)
            field = new Float32Array(total)

            sprites = palette.map((color) =>
                [0, 1, 2, 3].map((variant) =>
                    makeBrick(color, (variant & 1) > 0, (variant & 2) > 0)
                )
            )

            plateSprite = makePlate(backgroundColor)
            glowSprite = makePlate(glowColor)

            buildPlateLayer()
            spawn()

            pointer.x = columns * 0.5
            pointer.y = rows * 0.5
            pointer.strength = 0
            pointer.target = 0

            lastStep = -Infinity

            layout()
            droppedAt.fill(-Infinity)

            initialized = true
            updateAnimation()
        }

        const handlePointerMove = (event: PointerEvent) => {
            if (isStaticRenderer || width <= 0 || height <= 0) {
                return
            }

            const rect = host.getBoundingClientRect()

            pointer.x = (event.clientX - rect.left) / cell
            pointer.y = (event.clientY - rect.top) / cell
            pointer.target = 1
        }

        const handlePointerLeave = () => {
            pointer.target = 0
        }

        const handleVisibility = () => {
            updateAnimation()
        }

        const handleReducedMotion = () => {
            updateAnimation()
        }

        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(host)

        const intersectionObserver = new IntersectionObserver(
            (entries) => {
                const entry = entries[0]

                visible = Boolean(entry?.isIntersecting)

                if (initialized) {
                    updateAnimation()
                }
            },
            {
                threshold: 0,
            }
        )

        intersectionObserver.observe(host)

        host.addEventListener("pointermove", handlePointerMove, {
            passive: true,
        })

        host.addEventListener("pointerleave", handlePointerLeave)

        document.addEventListener("visibilitychange", handleVisibility)

        if (reducedMotionQuery.addEventListener) {
            reducedMotionQuery.addEventListener("change", handleReducedMotion)
        } else {
            reducedMotionQuery.addListener(handleReducedMotion)
        }

        resize()

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame)
            }

            animationFrame = 0

            resizeObserver.disconnect()
            intersectionObserver.disconnect()

            host.removeEventListener("pointermove", handlePointerMove)
            host.removeEventListener("pointerleave", handlePointerLeave)

            document.removeEventListener(
                "visibilitychange",
                handleVisibility
            )

            if (reducedMotionQuery.removeEventListener) {
                reducedMotionQuery.removeEventListener(
                    "change",
                    handleReducedMotion
                )
            } else {
                reducedMotionQuery.removeListener(handleReducedMotion)
            }
        }
    }, [
        backgroundColor,
        bodyColor,
        coolColor1,
        coolColor2,
        coolColor3,
        warmColor1,
        warmColor2,
        eyeColor,
        glowColor,
        studSize,
        catDensity,
        isStaticRenderer,
    ])

    return (
        <div
            ref={hostRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                isolation: "isolate",
                backgroundColor,
            }}
        >
            <canvas
                ref={canvasRef}
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                    pointerEvents: "none",
                }}
            />
        </div>
    )
}

KarimSaifBrickCats.displayName = "Karim Saif Brick Cats"

KarimSaifBrickCats.defaultProps = {
    backgroundColor: "#1f1f21",
    bodyColor: "#0d0d0e",
    coolColor1: "#8a6cff",
    coolColor2: "#5b3de8",
    coolColor3: "#4128d4",
    warmColor1: "#d2123d",
    warmColor2: "#ef7a10",
    eyeColor: "#d8d8d8",
    glowColor: "#4a4a52",
    studSize: 18,
    catDensity: 1,
    speed: 1,
    hoverStrength: 1,
    showHoverGlow: true,
    brickDrop: true,
    paused: false,
}

addPropertyControls(KarimSaifBrickCats, {
    backgroundColor: {
        type: ControlType.Color,
        title: "Baseplate",
        defaultValue: "#1f1f21",
        description:
            "Sets the main color of the studded brick baseplate.",
    },
    bodyColor: {
        type: ControlType.Color,
        title: "Cat Body",
        defaultValue: "#0d0d0e",
        description: "Sets the primary color used for the cat bodies.",
    },
    eyeColor: {
        type: ControlType.Color,
        title: "Eyes",
        defaultValue: "#d8d8d8",
        description:
            "Sets the color of the cat eyes and eye highlights.",
    },
    coolColor1: {
        type: ControlType.Color,
        title: "Cool 1",
        defaultValue: "#8a6cff",
        description:
            "Sets the first cool color used on the cats' left-facing edge bricks.",
    },
    coolColor2: {
        type: ControlType.Color,
        title: "Cool 2",
        defaultValue: "#5b3de8",
        description:
            "Sets the second cool color used on the cats' edge bricks.",
    },
    coolColor3: {
        type: ControlType.Color,
        title: "Cool 3",
        defaultValue: "#4128d4",
        description:
            "Sets the third cool color used on the cats' edge bricks.",
    },
    warmColor1: {
        type: ControlType.Color,
        title: "Warm 1",
        defaultValue: "#d2123d",
        description:
            "Sets the first warm color used on right-facing edge bricks.",
    },
    warmColor2: {
        type: ControlType.Color,
        title: "Warm 2",
        defaultValue: "#ef7a10",
        description:
            "Sets the second warm color used on right-facing edge bricks.",
    },
    glowColor: {
        type: ControlType.Color,
        title: "Glow Color",
        defaultValue: "#4a4a52",
        description:
            "Sets the color of the soft interactive glow beneath the pointer.",
    },
    studSize: {
        type: ControlType.Number,
        title: "Stud Size",
        defaultValue: 18,
        min: 10,
        max: 48,
        step: 1,
        unit: "px",
        description:
            "Controls the size of each brick cell and baseplate stud. Larger values improve performance on large sections.",
    },
    catDensity: {
        type: ControlType.Number,
        title: "Cat Density",
        defaultValue: 1,
        min: 0.35,
        max: 2,
        step: 0.05,
        description:
            "Controls how many animated cats are distributed across the component.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 1,
        min: 0,
        max: 3,
        step: 0.05,
        description:
            "Controls the overall movement speed of the cats and their brick transitions.",
    },
    hoverStrength: {
        type: ControlType.Number,
        title: "Hover Strength",
        defaultValue: 1,
        min: 0,
        max: 2,
        step: 0.05,
        description:
            "Controls how strongly the nearest cat follows the pointer and how much the other cats react.",
    },
    showHoverGlow: {
        type: ControlType.Boolean,
        title: "Hover Glow",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
        description:
            "Controls whether a soft illuminated area follows the pointer across the baseplate.",
    },
    brickDrop: {
        type: ControlType.Boolean,
        title: "Brick Drop",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        description:
            "Controls the small physical drop and scale animation when cat bricks change position.",
    },
    paused: {
        type: ControlType.Boolean,
        title: "Paused",
        defaultValue: false,
        enabledTitle: "Paused",
        disabledTitle: "Playing",
        description:
            "Made with 💛 by [@karimsaif](https://x.com/karimsaif0)",
    },
})
