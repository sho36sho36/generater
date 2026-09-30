"use strict";


class Random {
    constructor(seed) {
        this.seed = Number(seed) >>> 0;
    }

    next() {
        this.seed += 0x6D2B79F5;

        let t = this.seed;

        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min, max) {
        return min + this.next() * (max - min);
    }

    integer(min, max) {
        return Math.floor(this.range(min, max + 1));
    }

    pick(array) {
        return array[this.integer(0, array.length - 1)];
    }
}


function hashString(text) {

    let hash = 2166136261;

    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}


function noise(x, y, seed) {

    const n =
        Math.sin(
            x * 12.9898 +
            y * 78.233 +
            seed * 37.719
        ) *
        43758.5453;

    return n - Math.floor(n);
}


function smoothNoise(x, y, seed) {

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);

    const xf = x - x0;
    const yf = y - y0;

    const fadeX = xf * xf * (3 - 2 * xf);
    const fadeY = yf * yf * (3 - 2 * yf);

    const n00 = noise(x0, y0, seed);
    const n10 = noise(x0 + 1, y0, seed);
    const n01 = noise(x0, y0 + 1, seed);
    const n11 = noise(x0 + 1, y0 + 1, seed);

    const nx0 = n00 + (n10 - n00) * fadeX;
    const nx1 = n01 + (n11 - n01) * fadeX;

    return nx0 + (nx1 - nx0) * fadeY;
}


function fractalNoise(x, y, seed) {

    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;

    for (let i = 0; i < 5; i++) {

        value +=
            smoothNoise(
                x * frequency,
                y * frequency,
                seed + i * 100
            ) * amplitude;

        total += amplitude;

        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / total;
}


function createGradient(ctx, width, height, colors, vertical = true) {

    const gradient = vertical
        ? ctx.createLinearGradient(0, 0, 0, height)
        : ctx.createLinearGradient(0, 0, width, height);

    const step = 1 / (colors.length - 1);

    colors.forEach((color, index) => {
        gradient.addColorStop(index * step, color);
    });

    return gradient;
}


function drawStars(ctx, width, height, random, amount) {

    for (let i = 0; i < amount; i++) {

        const x = random.range(0, width);
        const y = random.range(0, height);

        const radius =
            random.next() < 0.9
                ? random.range(0.4, 1.4)
                : random.range(1.5, 3);

        const alpha = random.range(0.4, 1);

        ctx.fillStyle =
            `rgba(255,255,255,${alpha})`;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}


function drawMountains(ctx, width, height, random, color, baseY) {

    ctx.fillStyle = color;

    ctx.beginPath();

    ctx.moveTo(0, baseY);

    const points = 15;

    for (let i = 0; i <= points; i++) {

        const x = (i / points) * width;

        const peak =
            baseY -
            random.range(
                height * 0.08,
                height * 0.35
            );

        ctx.lineTo(x, peak);
    }

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);

    ctx.closePath();
    ctx.fill();
}


function drawSun(ctx, width, height, random, color) {

    const x = random.range(width * 0.25, width * 0.75);
    const y = random.range(height * 0.18, height * 0.48);

    const radius = width * random.range(0.06, 0.12);

    const gradient =
        ctx.createRadialGradient(
            x,
            y,
            radius * 0.1,
            x,
            y,
            radius * 3
        );

    gradient.addColorStop(
        0,
        color
    );

    gradient.addColorStop(
        1,
        "rgba(255,255,255,0)"
    );

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius * 3,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle = color;

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );

    ctx.fill();
}


function drawOcean(ctx, width, height, random) {

    const horizon = height * 0.58;

    ctx.fillStyle = "#075985";

    ctx.fillRect(
        0,
        horizon,
        width,
        height - horizon
    );

    for (let y = horizon; y < height; y += 4) {

        const progress =
            (y - horizon) /
            (height - horizon);

        const alpha =
            0.15 +
            progress * 0.45;

        ctx.strokeStyle =
            `rgba(255,255,255,${alpha})`;

        ctx.lineWidth = 1;

        ctx.beginPath();

        for (
            let x = 0;
            x < width;
            x += 5
        ) {

            const wave =
                Math.sin(
                    x * 0.025 +
                    y * 0.07 +
                    random.seed
                ) * 2;

            if (x === 0) {
                ctx.moveTo(x, y + wave);
            } else {
                ctx.lineTo(x, y + wave);
            }
        }

        ctx.stroke();
    }
}


function drawForest(ctx, width, height, random) {

    const ground = height * 0.64;

    ctx.fillStyle = "#064e3b";

    ctx.fillRect(
        0,
        ground,
        width,
        height - ground
    );

    const trees = Math.floor(width / 18);

    for (let i = 0; i < trees; i++) {

        const x =
            random.range(-20, width + 20);

        const treeHeight =
            random.range(
                height * 0.25,
                height * 0.62
            );

        const base =
            ground + random.range(0, height * 0.25);

        ctx.fillStyle = "#3f291b";

        ctx.fillRect(
            x - 3,
            base - treeHeight * 0.35,
            6,
            treeHeight * 0.35
        );

        ctx.fillStyle =
            random.pick([
                "#14532d",
                "#166534",
                "#15803d",
                "#166534",
                "#064e3b"
            ]);

        const layers = 4;

        for (let j = 0; j < layers; j++) {

            const y =
                base -
                treeHeight +
                j * treeHeight * 0.17;

            const radius =
                treeHeight *
                (0.16 + j * 0.025);

            ctx.beginPath();

            ctx.moveTo(x, y);

            ctx.lineTo(
                x - radius,
                y + radius * 2
            );

            ctx.lineTo(
                x + radius,
                y + radius * 2
            );

            ctx.closePath();

            ctx.fill();
        }
    }
}


function drawCity(ctx, width, height, random) {

    const ground = height * 0.78;

    ctx.fillStyle = "#050816";

    ctx.fillRect(
        0,
        ground,
        width,
        height - ground
    );

    let x = 0;

    while (x < width) {

        const buildingWidth =
            random.range(
                width * 0.035,
                width * 0.12
            );

        const buildingHeight =
            random.range(
                height * 0.15,
                height * 0.65
            );

        const y =
            ground - buildingHeight;

        const buildingColor =
            random.pick([
                "#111827",
                "#172554",
                "#1e1b4b",
                "#0f172a"
            ]);

        ctx.fillStyle = buildingColor;

        ctx.fillRect(
            x,
            y,
            buildingWidth,
            buildingHeight
        );

        const rows =
            Math.floor(buildingHeight / 15);

        const cols =
            Math.floor(buildingWidth / 12);

        for (let row = 0; row < rows; row++) {

            for (let col = 0; col < cols; col++) {

                if (random.next() < 0.35) {

                    const wx =
                        x + 4 + col * 12;

                    const wy =
                        y + 5 + row * 15;

                    ctx.fillStyle =
                        random.pick([
                            "#fef08a",
                            "#67e8f9",
                            "#f0abfc",
                            "#a7f3d0"
                        ]);

                    ctx.fillRect(
                        wx,
                        wy,
                        4,
                        6
                    );
                }
            }
        }

        x += buildingWidth + 2;
    }
}


function drawParticles(ctx, width, height, random, colors, count) {

    for (let i = 0; i < count; i++) {

        const x = random.range(0, width);
        const y = random.range(0, height);

        const radius = random.range(1, 5);

        ctx.fillStyle =
            random.pick(colors);

        ctx.globalAlpha =
            random.range(0.15, 0.8);

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.globalAlpha = 1;
}


function drawAbstract(ctx, width, height, random, quality) {

    const palettes = [
        ["#7c3aed", "#ec4899", "#06b6d4"],
        ["#f97316", "#eab308", "#ef4444"],
        ["#22c55e", "#06b6d4", "#3b82f6"],
        ["#8b5cf6", "#6366f1", "#14b8a6"]
    ];

    const palette = random.pick(palettes);

    ctx.fillStyle =
        createGradient(
            ctx,
            width,
            height,
            palette
        );

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    const count =
        quality === "high"
            ? 180
            : quality === "medium"
                ? 100
                : 55;

    ctx.globalCompositeOperation = "screen";

    for (let i = 0; i < count; i++) {

        const x = random.range(-width * 0.2, width * 1.2);
        const y = random.range(-height * 0.2, height * 1.2);

        const radius =
            random.range(
                width * 0.01,
                width * 0.25
            );

        const gradient =
            ctx.createRadialGradient(
                x,
                y,
                0,
                x,
                y,
                radius
            );

        gradient.addColorStop(
            0,
            random.pick(palette)
        );

        gradient.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.fillStyle = gradient;

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.globalCompositeOperation =
        "source-over";
}


function drawSpace(ctx, width, height, random, quality) {

    ctx.fillStyle =
        createGradient(
            ctx,
            width,
            height,
            [
                "#020617",
                "#0f172a",
                "#1e1b4b"
            ]
        );

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    const stars =
        quality === "high"
            ? 1000
            : quality === "medium"
                ? 500
                : 250;

    drawStars(
        ctx,
        width,
        height,
        random,
        stars
    );

    const x =
        random.range(
            width * 0.25,
            width * 0.75
        );

    const y =
        random.range(
            height * 0.3,
            height * 0.7
        );

    const radius =
        width * random.range(
            0.08,
            0.17
        );

    const planetGradient =
        ctx.createRadialGradient(
            x - radius * 0.35,
            y - radius * 0.35,
            radius * 0.1,
            x,
            y,
            radius
        );

    planetGradient.addColorStop(
        0,
        "#bae6fd"
    );

    planetGradient.addColorStop(
        0.45,
        "#2563eb"
    );

    planetGradient.addColorStop(
        1,
        "#172554"
    );

    ctx.fillStyle = planetGradient;

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle =
        "rgba(255,255,255,0.35)";

    ctx.lineWidth = radius * 0.07;

    ctx.beginPath();

    ctx.ellipse(
        x,
        y,
        radius * 1.6,
        radius * 0.35,
        -0.2,
        0,
        Math.PI * 2
    );

    ctx.stroke();
}


function drawSunset(ctx, width, height, random) {

    ctx.fillStyle =
        createGradient(
            ctx,
            width,
            height,
            [
                "#312e81",
                "#db2777",
                "#f97316",
                "#facc15"
            ]
        );

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    drawSun(
        ctx,
        width,
        height,
        random,
        "#fff7ae"
    );

    drawMountains(
        ctx,
        width,
        height,
        random,
        "#241b35",
        height * 0.72
    );

    drawMountains(
        ctx,
        width,
        height,
        random,
        "#111827",
        height * 0.82
    );
}


function drawOceanScene(ctx, width, height, random) {

    ctx.fillStyle =
        createGradient(
            ctx,
            width,
            height,
            [
                "#38bdf8",
                "#bae6fd",
                "#fef3c7"
            ]
        );

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    drawSun(
        ctx,
        width,
        height,
        random,
        "#fff7ed"
    );

    drawOcean(
        ctx,
        width,
        height,
        random
    );
}


function drawForestScene(ctx, width, height, random) {

    ctx.fillStyle =
        createGradient(
            ctx,
            width,
            height,
            [
                "#0f172a",
                "#14532d",
                "#064e3b"
            ]
        );

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    drawForest(
        ctx,
        width,
        height,
        random
    );

    drawParticles(
        ctx,
        width,
        height,
        random,
        [
            "#bbf7d0",
            "#86efac",
            "#fef08a"
        ],
        100
    );
}


function drawCityScene(ctx, width, height, random) {

    ctx.fillStyle =
        createGradient(
            ctx,
            width,
            height,
            [
                "#020617",
                "#172554",
                "#312e81"
            ]
        );

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    drawStars(
        ctx,
        width,
        height * 0.55,
        random,
        180
    );

    drawCity(
        ctx,
        width,
        height,
        random
    );
}


function containsAny(text, words) {

    return words.some(
        word => text.includes(word)
    );
}


function generateImage(canvas, options) {

    const {
        prompt,
        size,
        seed,
        quality
    } = options;

    canvas.width = size;
    canvas.height = size;

    const ctx =
        canvas.getContext("2d", {
            alpha: false
        });

    const random =
        new Random(
            (Number(seed) || 0) ^
            hashString(prompt)
        );

    const text =
        prompt.toLowerCase();

    if (
        containsAny(text, [
            "宇宙",
            "星空",
            "惑星",
            "space",
            "galaxy",
            "planet"
        ])
    ) {

        drawSpace(
            ctx,
            size,
            size,
            random,
            quality
        );

    } else if (
        containsAny(text, [
            "夕焼け",
            "夕日",
            "sunset",
            "dusk"
        ])
    ) {

        drawSunset(
            ctx,
            size,
            size,
            random
        );

    } else if (
        containsAny(text, [
            "海",
            "ビーチ",
            "海岸",
            "ocean",
            "sea",
            "beach"
        ])
    ) {

        drawOceanScene(
            ctx,
            size,
            size,
            random
        );

    } else if (
        containsAny(text, [
            "森",
            "森林",
            "木",
            "forest",
            "woods"
        ])
    ) {

        drawForestScene(
            ctx,
            size,
            size,
            random
        );

    } else if (
        containsAny(text, [
            "都市",
            "街",
            "都会",
            "ネオン",
            "city",
            "cyberpunk"
        ])
    ) {

        drawCityScene(
            ctx,
            size,
            size,
            random
        );

    } else if (
        containsAny(text, [
            "抽象",
            "abstract",
            "art",
            "芸術"
        ])
    ) {

        drawAbstract(
            ctx,
            size,
            size,
            random,
            quality
        );

    } else {

        drawAbstract(
            ctx,
            size,
            size,
            random,
            quality
        );
    }

    /*
     * 全体に軽いノイズを追加。
     * 高品質モードだけ強めにする。
     */

    const density =
        quality === "high"
            ? 0.025
            : quality === "medium"
                ? 0.012
                : 0.005;

    const image =
        ctx.getImageData(
            0,
            0,
            size,
            size
        );

    const data = image.data;

    for (let i = 0; i < data.length; i += 4) {

        if (random.next() < density) {

            const amount =
                random.integer(
                    -8,
                    8
                );

            data[i] =
                Math.max(
                    0,
                    Math.min(
                        255,
                        data[i] + amount
                    )
                );

            data[i + 1] =
                Math.max(
                    0,
                    Math.min(
                        255,
                        data[i + 1] + amount
                    )
                );

            data[i + 2] =
                Math.max(
                    0,
                    Math.min(
                        255,
                        data[i + 2] + amount
                    )
                );
        }
    }

    ctx.putImageData(
        image,
        0,
        0
    );

    return canvas;
}
