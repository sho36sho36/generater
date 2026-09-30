import { Txt2ImgWorkerClient } from "https://cdn.jsdelivr.net/npm/web-txt2img@0.3.1/dist/index.js";

/* =========================================================
   AI Image Generator
   GitHub Pages / WebGPU / SD-Turbo
   ========================================================= */

/* ---------- DOM ---------- */

const promptInput = document.getElementById("prompt");
const negativePromptInput = document.getElementById("negativePrompt");

const seedInput = document.getElementById("seed");
const stepsInput = document.getElementById("steps");

const generateButton = document.getElementById("generate");
const cancelButton = document.getElementById("cancel");

const downloadButton = document.getElementById("downloadButton");

const clearHistoryButton = document.getElementById("clearHistory");

const themeButton = document.getElementById("themeButton");

const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const statusElement = document.getElementById("status");
const statusBadge = document.getElementById("statusBadge");

const webgpuStatus = document.getElementById("webgpuStatus");
const modelStatus = document.getElementById("modelStatus");

const resultImage = document.getElementById("resultImage");
const resultPlaceholder = document.getElementById("resultPlaceholder");

const historyElement = document.getElementById("history");


/* ---------- State ---------- */

let client = null;
let modelLoaded = false;
let generating = false;

let currentAbort = null;
let currentImageURL = null;


/* =========================================================
   Utility
   ========================================================= */

function setProgress(value, text = null) {
    let percent = Number(value);

    if (!Number.isFinite(percent)) {
        percent = 0;
    }

    percent = Math.max(0, Math.min(100, percent));

    if (progressBar) {
        progressBar.value = percent;

        if (progressBar.style) {
            progressBar.style.width = `${percent}%`;
        }
    }

    if (progressText) {
        progressText.textContent =
            text !== null
                ? text
                : `${Math.round(percent)}%`;
    }
}


function setStatus(text, type = "loading") {
    if (statusElement) {
        statusElement.textContent = text;
    }

    if (statusBadge) {
        statusBadge.textContent =
            type === "ready"
                ? "準備完了"
                : type === "error"
                    ? "エラー"
                    : type === "generating"
                        ? "生成中"
                        : "準備中";

        statusBadge.className = "status-badge";

        if (type === "ready") {
            statusBadge.classList.add("success");
        } else if (type === "error") {
            statusBadge.classList.add("error");
        } else if (type === "generating") {
            statusBadge.classList.add("generating");
        }
    }
}


function setButtonState() {
    if (generateButton) {
        generateButton.disabled = generating || !modelLoaded;
    }

    if (cancelButton) {
        cancelButton.disabled = !generating;
    }
}


function randomSeed() {
    return Math.floor(Math.random() * 2147483647);
}


function getSeed() {
    const value = Number(seedInput?.value);

    if (Number.isInteger(value) && value >= 0) {
        return value;
    }

    return randomSeed();
}


function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "";
    }

    const units = ["B", "KB", "MB", "GB"];

    let value = bytes;
    let index = 0;

    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index++;
    }

    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}


/* =========================================================
   WebGPU / Model initialization
   ========================================================= */

async function initializeAI() {
    try {
        setStatus("AIモデルを準備しています...", "loading");

        setProgress(0, "0%");

        if (webgpuStatus) {
            webgpuStatus.textContent = "確認中...";
        }

        if (modelStatus) {
            modelStatus.textContent = "読み込み前";
        }

        /*
         * web-txt2img Worker client
         *
         * The package itself creates the module Worker.
         */
        client = Txt2ImgWorkerClient.createDefault();

        /* ---------- Detect capabilities ---------- */

        const capabilities = await client.detect();

        console.log("WebGPU capabilities:", capabilities);

        if (capabilities?.webgpu) {
            if (webgpuStatus) {
                webgpuStatus.textContent = "利用可能";
            }
        } else {
            if (webgpuStatus) {
                webgpuStatus.textContent = "利用できません";
            }

            throw new Error(
                "このブラウザではWebGPUを利用できません。ChromeまたはEdgeなどのWebGPU対応ブラウザを使用してください。"
            );
        }

        /* ---------- Load SD-Turbo ---------- */

        if (modelStatus) {
            modelStatus.textContent = "SD-Turbo読み込み中...";
        }

        setStatus("AIモデルを読み込んでいます...", "loading");

        setProgress(0, "モデル読み込み中... 0%");

        const loadResult = await client.load(
            "sd-turbo",
            {
                backendPreference: ["webgpu"]
            },
            progress => {
                console.log("Model load:", progress);

                /*
                 * web-txt2img 0.3.x provides pct when available.
                 */
                let percent = null;

                if (typeof progress?.pct === "number") {
                    percent = progress.pct;
                }

                if (percent === null && typeof progress?.progress === "number") {
                    percent = progress.progress;
                }

                if (percent !== null) {
                    /*
                     * Some APIs use 0-1, others 0-100.
                     */
                    if (percent >= 0 && percent <= 1) {
                        percent *= 100;
                    }

                    const downloaded =
                        formatBytes(progress?.bytesDownloaded);

                    const total =
                        formatBytes(progress?.totalBytesExpected);

                    let text = `モデル読み込み中... ${Math.round(percent)}%`;

                    if (downloaded && total) {
                        text += ` (${downloaded} / ${total})`;
                    }

                    setProgress(percent, text);
                } else {
                    setProgress(
                        0,
                        "モデルを読み込んでいます..."
                    );
                }
            }
        );

        console.log("Model load result:", loadResult);

        if (!loadResult?.ok) {
            throw new Error(
                loadResult?.message ||
                "SD-Turboの読み込みに失敗しました。"
            );
        }

        modelLoaded = true;

        if (modelStatus) {
            modelStatus.textContent = "SD-Turbo準備完了";
        }

        setProgress(100, "100%");

        setStatus("AIモデルの準備が完了しました", "ready");

        setButtonState();

        console.log("AI model ready.");
    } catch (error) {
        console.error("AI initialization failed:", error);

        modelLoaded = false;

        if (webgpuStatus && !webgpuStatus.textContent) {
            webgpuStatus.textContent = "エラー";
        }

        if (modelStatus) {
            modelStatus.textContent = "読み込み失敗";
        }

        setProgress(0, "読み込みに失敗しました");

        setStatus(
            `AIモデルを読み込めませんでした: ${error.message}`,
            "error"
        );

        setButtonState();
    }
}


/* =========================================================
   Image generation
   ========================================================= */

async function generateImage() {
    if (generating) {
        return;
    }

    if (!client || !modelLoaded) {
        setStatus(
            "AIモデルがまだ準備できていません。",
            "error"
        );
        return;
    }

    const prompt = promptInput?.value.trim() || "";

    if (!prompt) {
        setStatus(
            "プロンプトを入力してください。",
            "error"
        );

        promptInput?.focus();

        return;
    }

    const seed = getSeed();

    /*
     * Keep the value in the input so the generated image
     * can be reproduced.
     */
    if (seedInput) {
        seedInput.value = seed;
    }

    generating = true;
    setButtonState();

    setStatus("画像を生成しています...", "generating");

    setProgress(0, "生成開始...");

    if (resultPlaceholder) {
        resultPlaceholder.style.display = "none";
    }

    if (resultImage) {
        resultImage.style.display = "none";
    }

    /*
     * Revoke previous temporary object URL.
     */
    if (currentImageURL) {
        URL.revokeObjectURL(currentImageURL);
        currentImageURL = null;
    }

    try {
        /*
         * SD-Turbo supports 512x512.
         *
         * Negative prompt is kept in the UI for compatibility,
         * but SD-Turbo's current API does not expose a negative
         * prompt parameter in the generate call.
         */
        const request = client.generate(
            {
                prompt,
                seed,
                width: 512,
                height: 512
            },
            event => {
                console.log("Generation:", event);

                let percent = null;

                if (typeof event?.pct === "number") {
                    percent = event.pct;
                }

                if (typeof event?.progress === "number") {
                    percent = event.progress;
                }

                if (
                    typeof event?.percent === "number"
                ) {
                    percent = event.percent;
                }

                if (percent !== null) {
                    if (percent >= 0 && percent <= 1) {
                        percent *= 100;
                    }

                    setProgress(
                        percent,
                        `生成中... ${Math.round(percent)}%`
                    );
                } else if (event?.phase) {
                    setStatus(
                        `画像を生成しています... ${event.phase}`,
                        "generating"
                    );
                }
            },
            {
                busyPolicy: "queue",
                debounceMs: 200
            }
        );

        currentAbort = request.abort;

        const result = await request.promise;

        currentAbort = null;

        console.log("Generation result:", result);

        if (!result?.ok) {
            if (result?.reason === "aborted") {
                setStatus(
                    "画像生成をキャンセルしました。",
                    "loading"
                );

                setProgress(0, "キャンセルしました");

                return;
            }

            throw new Error(
                result?.message ||
                `画像生成に失敗しました (${result?.reason || "unknown"})`
            );
        }

        /* ---------- Display image ---------- */

        currentImageURL = URL.createObjectURL(result.blob);

        if (resultImage) {
            resultImage.src = currentImageURL;
            resultImage.style.display = "block";
        }

        if (resultPlaceholder) {
            resultPlaceholder.style.display = "none";
        }

        if (downloadButton) {
            downloadButton.disabled = false;
        }

        setProgress(100, "100%");

        setStatus(
            "画像の生成が完了しました",
            "ready"
        );

        /* ---------- Save history ---------- */

        saveHistoryItem({
            prompt,
            seed,
            image: currentImageURL
        });

        /*
         * Blob URLs cannot be stored in localStorage permanently.
         * We save history metadata only, while the current image
         * remains available during this page session.
         */
        saveHistoryMetadata({
            prompt,
            seed,
            createdAt: Date.now()
        });

        console.log(
            "Generation finished:",
            Math.round(result.timeMs || 0),
            "ms"
        );
    } catch (error) {
        console.error("Generation error:", error);

        if (
            error?.name === "AbortError" ||
            error?.message?.toLowerCase().includes("abort")
        ) {
            setStatus(
                "画像生成をキャンセルしました。",
                "loading"
            );

            setProgress(0, "キャンセルしました");
        } else {
            setStatus(
                `画像生成に失敗しました: ${error.message}`,
                "error"
            );

            setProgress(0, "生成失敗");
        }
    } finally {
        generating = false;
        currentAbort = null;

        setButtonState();
    }
}


/* =========================================================
   Cancel
   ========================================================= */

function cancelGeneration() {
    if (!generating) {
        return;
    }

    console.log("Cancel requested.");

    if (typeof currentAbort === "function") {
        currentAbort();
    }

    setStatus(
        "画像生成をキャンセルしています...",
        "loading"
    );

    setProgress(0, "キャンセル中...");
}


/* =========================================================
   Download
   ========================================================= */

function downloadCurrentImage() {
    if (!currentImageURL) {
        return;
    }

    const link = document.createElement("a");

    link.href = currentImageURL;
    link.download = `ai-image-${Date.now()}.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();
}


/* =========================================================
   History
   ========================================================= */

const HISTORY_KEY = "ai-image-generator-history";


function loadHistoryMetadata() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);

        if (!raw) {
            return [];
        }

        const data = JSON.parse(raw);

        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn("History load failed:", error);
        return [];
    }
}


function saveHistoryMetadata(item) {
    try {
        const history = loadHistoryMetadata();

        history.unshift(item);

        /*
         * Keep the history small.
         */
        const trimmed = history.slice(0, 30);

        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(trimmed)
        );
    } catch (error) {
        console.warn("History save failed:", error);
    }
}


function saveHistoryItem(item) {
    /*
     * Current generated image is shown in the UI.
     *
     * We intentionally do not put Blob URLs into localStorage
     * because Blob URLs are temporary and become invalid after
     * the page session ends.
     */
    if (!historyElement) {
        return;
    }

    const card = document.createElement("div");

    card.className = "history-item";

    const image = document.createElement("img");

    image.src = item.image;
    image.alt = item.prompt;

    image.loading = "lazy";

    const text = document.createElement("div");

    text.className = "history-prompt";
    text.textContent = item.prompt;

    const seed = document.createElement("div");

    seed.className = "history-seed";
    seed.textContent = `Seed: ${item.seed}`;

    card.appendChild(image);
    card.appendChild(text);
    card.appendChild(seed);

    historyElement.prepend(card);

    /*
     * Limit visible history.
     */
    while (historyElement.children.length > 20) {
        historyElement.lastElementChild.remove();
    }
}


function restoreHistoryMetadata() {
    /*
     * Metadata is restored only when useful UI elements exist.
     *
     * Since the actual Blob URLs cannot survive a page reload,
     * we don't attempt to display nonexistent image URLs.
     */
    const history = loadHistoryMetadata();

    console.log(
        `保存されている生成履歴: ${history.length}件`
    );
}


function clearHistory() {
    try {
        localStorage.removeItem(HISTORY_KEY);
    } catch (error) {
        console.warn("History clear failed:", error);
    }

    if (historyElement) {
        historyElement.innerHTML = "";
    }
}


/* =========================================================
   Quick prompts
   ========================================================= */

function setupQuickPrompts() {
    const buttons = document.querySelectorAll(
        "[data-prompt]"
    );

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const value = button.dataset.prompt;

            if (!value || !promptInput) {
                return;
            }

            promptInput.value = value;

            promptInput.focus();
        });
    });
}


/* =========================================================
   Theme
   ========================================================= */

function setupTheme() {
    if (!themeButton) {
        return;
    }

    themeButton.addEventListener("click", () => {
        document.body.classList.toggle("dark");

        const dark =
            document.body.classList.contains("dark");

        localStorage.setItem(
            "ai-image-generator-theme",
            dark ? "dark" : "light"
        );
    });

    const saved =
        localStorage.getItem(
            "ai-image-generator-theme"
        );

    if (saved === "dark") {
        document.body.classList.add("dark");
    }
}


/* =========================================================
   Events
   ========================================================= */

function setupEvents() {
    generateButton?.addEventListener(
        "click",
        generateImage
    );

    cancelButton?.addEventListener(
        "click",
        cancelGeneration
    );

    downloadButton?.addEventListener(
        "click",
        downloadCurrentImage
    );

    clearHistoryButton?.addEventListener(
        "click",
        clearHistory
    );

    /*
     * Ctrl + Enter / Ctrl + Return
     */
    promptInput?.addEventListener(
        "keydown",
        event => {
            if (
                event.ctrlKey &&
                event.key === "Enter"
            ) {
                event.preventDefault();

                if (!generating && modelLoaded) {
                    generateImage();
                }
            }
        }
    );
}


/* =========================================================
   Startup
   ========================================================= */

async function start() {
    console.log(
        "AI Image Generator starting..."
    );

    /*
     * Disable generation until model is ready.
     */
    if (generateButton) {
        generateButton.disabled = true;
    }

    if (cancelButton) {
        cancelButton.disabled = true;
    }

    if (downloadButton) {
        downloadButton.disabled = true;
    }

    setupTheme();
    setupEvents();
    setupQuickPrompts();
    restoreHistoryMetadata();

    /*
     * Generate a random initial seed.
     */
    if (seedInput) {
        const current = Number(seedInput.value);

        if (!Number.isInteger(current)) {
            seedInput.value = randomSeed();
        }
    }

    await initializeAI();
}


/* =========================================================
   Global error handling
   ========================================================= */

window.addEventListener(
    "error",
    event => {
        console.error(
            "Global error:",
            event.error || event.message
        );
    }
);


window.addEventListener(
    "unhandledrejection",
    event => {
        console.error(
            "Unhandled promise rejection:",
            event.reason
        );
    }
);


/* ---------- Start ---------- */

start();
