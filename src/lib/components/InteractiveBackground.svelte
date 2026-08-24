<script lang="ts">
    import { onMount } from "svelte";

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null;
    let width: number;
    let height: number;
    let particles: Particle[] = [];

    // Configuration
    const particleCount = 60;
    const connectionDistance = 150;
    const mouseDistance = 200;

    let mouse = { x: 0, y: 0 };

    class Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        size: number;
        color: string;

        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 2 + 1;

            // Star colors (white/blueish/purplish)
            const colors = [
                "rgba(255, 255, 255, ",
                "rgba(216, 180, 254, ",
                "rgba(125, 211, 252, ",
            ];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Bounce off edges
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;

            // Mouse interaction
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < mouseDistance) {
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const force = (mouseDistance - distance) / mouseDistance;
                const directionX = forceDirectionX * force * 0.5;
                const directionY = forceDirectionY * force * 0.5;
                this.vx += directionX;
                this.vy += directionY;
            }

            // Friction
            this.vx *= 0.98; // High friction for stabilization since we add forces
            if (Math.abs(this.vx) < 0.2) this.vx = (Math.random() - 0.5) * 0.5; // Keep moving if stopped

            this.vy *= 0.98;
            if (Math.abs(this.vy) < 0.2) this.vy = (Math.random() - 0.5) * 0.5;
        }

        draw() {
            if (!ctx) return;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color + "0.8)"; // Base opacity
            ctx.fill();
        }
    }

    function init() {
        resize();
        particles = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
        animate();
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    function animate() {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();

            // Connect particles
            for (let j = i; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < connectionDistance) {
                    ctx.beginPath();
                    const opacity = 1 - distance / connectionDistance;
                    ctx.strokeStyle = `rgba(168, 85, 247, ${opacity * 0.2})`; // Purple tint
                    ctx.lineWidth = 1;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }

    function handleMouseMove(e: MouseEvent) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }

    onMount(() => {
        ctx = canvas.getContext("2d");
        init();

        window.addEventListener("resize", resize);
        window.addEventListener("mousemove", handleMouseMove);

        return () => {
            window.removeEventListener("resize", resize);
            window.removeEventListener("mousemove", handleMouseMove);
        };
    });
</script>

<canvas
    bind:this={canvas}
    class="pointer-events-none fixed inset-0 z-0 opacity-40"
></canvas>
