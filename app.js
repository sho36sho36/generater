import {
    detectCapabilities,
    loadModel,
    generateImage,
    unloadModel
} from "https://cdn.jsdelivr.net/npm/web-txt2img@0.3.1/dist/index.js";

import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.webgpu.min.mjs";

const MODEL_ID = "sd-turbo";
const IMAGE_SIZE = 512;
const HISTORY_KEY = "ai-image-generator-history";

let modelLoaded = false;
let generating = false;
let currentAbortController = null;
let capabilities = null;

const $ = (id) => document.getElementById(id);

const promptInput = $("prompt");
const negativePromptInput = $("negativePrompt");
const seedInput = $("seed");
const stepsInput = $("steps");

const generateButton = $("generateButton");
const cancelButton = $("cancelButton");

const resultImage = $("resultImage");
const resultPlaceholder = $("resultPlaceholder");

const progressBar = $("progressBar");
const progressText = $("progressText");

const statusBadge = $("statusBadge");
const webgpuStatus = $("webgpuStatus");
const modelStatus = $("modelStatus");

const historyGrid = $("historyGrid");
const clearHistoryButton = $("clearHistoryButton");
const themeButton = $("themeButton");


// ============================================================
// UI
// ============================================================

function setText(element, value) {
    if (element) {
        element.textContent = value;
    }
}

function setProgress(value, text = "") {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));

    if (progressBar) {
        progressBar.style.width = `${pct}%`;
    }

    if (progressText) {
        progressText.textContent = text || `${Math.round(pct)}%`;
    }
}

function setStatus(text, type = "") {
    setText(statusBadge, text);

    if (statusBadge) {
        statusBadge.className = "status-badge";

        if (type) {
            statusBadge.classList.add(type);
        }
    }
}

function setWebGPUStatus(text, ok = false) {
    setText(webgpuStatus, text);

    if (webgpuStatus) {
        webgpuStatus.classList.toggle("success", ok);
    }
}

function setModelStatus(text, ok = false) {
    setText(modelStatus, text);

    if (modelStatus) {
        modelStatus.classList.toggle("success", ok);
    }
}

function setGeneratingState(active) {
    generating = active;

    if (generateButton) {
        generateButton.disabled = active || !modelLoaded;
    }

    if (cancelButton) {
        cancelButton.disabled = !active;
    }
}


// ============================================================
// Progress
// ============================================================

function progressPercent(progress) {
    if (!progress) {
        return 0;
    }

    if (typeof progress === "number") {
        return progress <= 1 ? progress * 100 : progress;
    }

    if (typeof progress.pct === "number") {
        return progress.pct <= 1
            ? progress.pct * 100
            : progress.pct;
    }

    if (typeof progress.progress === "number") {
        return progress.progress <= 1
            ? progress.progress * 100
            : progress.progress;
    }

    return 0;
}

function progressMessage(progress, fallback = "") {
    if (!progress) {
        return fallback;
    }

    if (progress.phase) {
        return String(progress.phase);
    }

    if (progress.message) {
        return String(progress.message);
    }

    if (progress.asset) {
        return String(progress.asset);
    }

    return fallback;
}


// ============================================================
// AI initialization
// ============================================================

async function initializeAI() {
    console.log("AI initialization started.");

    setStatus("初期化中");
    setModelStatus("モデル確認中");
    setProgress(0, "WebGPUを確認中...");

    try {
        console.log("Checking web-txt2img capabilities...");

        capabilities = await detectCapabilities();

        console.log("Capabilities:", capabilities);

        if (!capabilities || !capabilities.webgpu) {
            setWebGPUStatus("利用不可", false);

            throw new Error(
                "WebGPUが利用できません。このサイトではCPU/WASMフォールバックを使用しません。"
            );
        }

        setWebGPUStatus(
            capabilities.shaderF16
                ? "WebGPU / F16対応"
                : "WebGPU対応",
            true
        );

        if (!capabilities.shaderF16) {
            console.warn(
                "shaderF16 is not available. WebGPU is available, but performance may be lower."
            );
        }

        setProgress(5, "ONNX Runtime WebGPUを準備中...");
        setModelStatus("モデル読み込み中");

        /*
         * SD-TurboはWebGPU専用。
         *
         * WASMをbackendPreferenceに入れないことで、
         * CPUへのフォールバックをさせない。
         */
        const loadResult = await loadModel(
            MODEL_ID,
            {
                backendPreference: ["webgpu"],

                // web-txt2imgへONNX Runtime Webを注入
                ort,

                // 念のためWASM設定は使わない
                onProgress: (progress) => {
                    const pct = progressPercent(progress);

                    const message = progressMessage(
                        progress,
                        "モデル読み込み中..."
                    );

                    // モデル読み込みを5～90%に表示
                    const uiPct = 5 + pct * 0.85;

                    setProgress(
                        uiPct,
                        `${message} ${Math.round(pct)}%`
                    );
                }
            }
        );

        console.log("Model loaded:", loadResult);

        if (!loadResult || loadResult.ok === false) {
            const message =
                loadResult?.message ||
                loadResult?.reason ||
                "モデルの読み込みに失敗しました。";

            throw new Error(message);
        }

        modelLoaded = true;

        setProgress(100, "準備完了");
        setModelStatus("SD-Turbo 読み込み完了", true);
        setStatus("準備完了", "success");

        if (generateButton) {
            generateButton.disabled = false;
        }

        console.log("AI initialization completed.");

    } catch (error) {
        console.error("AI initialization failed:", error);

        modelLoaded = false;

        setStatus("初期化失敗", "error");
        setModelStatus(
            error?.message || "モデルの読み込みに失敗しました。",
            false
        );

        setProgress(
            0,
            "AIを初期化できませんでした"
        );

        if (generateButton) {
            generateButton.disabled = true;
        }

        throw error;
    }
}


// ============================================================
// Image generation
// ============================================================

async function generate() {
    if (generating) {
        return;
    }

    if (!modelLoaded) {
        alert("AIモデルがまだ準備できていません。");
        return;
    }

    if (
        capabilities &&
        !capabilities.webgpu
    ) {
        alert(
            "WebGPUが利用できないため、生成できません。"
        );
        return;
    }

    const prompt = promptInput?.value.trim() || "";

    if (!prompt) {
        alert("プロンプトを入力してください。");
        promptInput?.focus();
        return;
    }

    const seedText = seedInput?.value.trim() || "";

    let seed;

    if (seedText === "") {
        seed = Math.floor(
            Math.random() * 2147483647
        );
    } else {
        seed = Number(seedText);

        if (!Number.isFinite(seed)) {
            alert("Seedには数字を入力してください。");
            seedInput?.focus();
            return;
        }

        seed = Math.floor(seed);
    }

    /*
     * SD-Turboはweb-txt2imgの仕様上、
     * 現在512x512で動作させる。
     *
     * UIにStepsがあっても、SD-Turbo側では
     * Stable Diffusionの通常stepsとして直接扱わない。
     */
    const negativePrompt =
        negativePromptInput?.value.trim() || "";

    console.log("Generation started.");
    console.log("Prompt:", prompt);
    console.log("Negative prompt:", negativePrompt);
    console.log("Seed:", seed);

    setGeneratingState(true);

    setStatus("生成中");
    setProgress(0, "生成を開始しています...");

    if (resultPlaceholder) {
        resultPlaceholder.style.display = "none";
    }

    currentAbortController =
        new AbortController();

    try {
        const result = await generateImage({
            model: MODEL_ID,
            prompt,
            seed,
            width: IMAGE_SIZE,
            height: IMAGE_SIZE,
            signal: currentAbortController.signal,

            onProgress: (progress) => {
                const pct = progressPercent(progress);

                const phase = progressMessage(
                    progress,
                    "画像生成中..."
                );

                setProgress(
                    pct,
                    `${phase} ${Math.round(pct)}%`
                );
            }
        });

        console.log("Generation result:", result);

        if (!result || result.ok === false) {
            const reason =
                result?.message ||
                result?.reason ||
                "画像生成に失敗しました。";

            throw new Error(reason);
        }

        if (!(result.blob instanceof Blob)) {
            throw new Error(
                "生成結果に画像データがありません。"
            );
        }

        const imageUrl =
            URL.createObjectURL(result.blob);

        if (resultImage) {
            resultImage.src = imageUrl;
            resultImage.style.display = "block";
        }

        if (resultPlaceholder) {
            resultPlaceholder.style.display = "none";
        }

        setProgress(100, "生成完了");
        setStatus("生成完了", "success");

        saveHistory({
            prompt,
            seed,
            url: imageUrl,
            createdAt: Date.now()
        });

        renderHistory();

        console.log(
            `Generation completed in ${
                result.timeMs ?? "?"
            } ms`
        );

    } catch (error) {
        if (
            currentAbortController?.signal.aborted
        ) {
            console.log("Generation cancelled.");

            setStatus("キャンセルしました");
            setProgress(0, "キャンセル");
        } else {
            console.error(
                "Generation failed:",
                error
            );

            setStatus("生成失敗", "error");

            setProgress(
                0,
                error?.message ||
                "画像生成に失敗しました。"
            );

            alert(
                `画像生成に失敗しました。\n\n${
                    error?.message || error
                }`
            );
        }
    } finally {
        currentAbortController = null;
        setGeneratingState(false);

        if (modelLoaded) {
            setModelStatus(
                "SD-Turbo 読み込み完了",
                true
            );
        }
    }
}


// ============================================================
// Cancel
// ============================================================

function cancelGeneration() {
    if (!currentAbortController) {
        return;
    }

    console.log("Cancelling generation...");

    currentAbortController.abort();

    setStatus("キャンセル中");
    setProgress(0, "キャンセルしています...");
}


// ============================================================
// History
// ============================================================

function getHistory() {
    try {
        const raw =
            localStorage.getItem(HISTORY_KEY);

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);

        return Array.isArray(parsed)
            ? parsed
            : [];
    } catch (error) {
        console.warn(
            "Failed to read history:",
            error
        );

        return [];
    }
}

function saveHistory(item) {
    try {
        let history = getHistory();

        history.unshift({
            prompt: item.prompt,
            seed: item.seed,
            url: item.url,
            createdAt: item.createdAt
        });

        // 最大20件
        history = history.slice(0, 20);

        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(history)
        );

        console.log(
            `保存されている生成履歴: ${history.length}件`
        );

    } catch (error) {
        console.warn(
            "Failed to save history:",
            error
        );
    }
}

function renderHistory() {
    if (!historyGrid) {
        return;
    }

    const history = getHistory();

    historyGrid.innerHTML = "";

    if (history.length === 0) {
        return;
    }

    for (const item of history) {
        const card =
            document.createElement("div");

        card.className = "history-item";

        const image =
            document.createElement("img");

        image.src = item.url;
        image.alt =
            item.prompt || "Generated image";
        image.loading = "lazy";

        const info =
            document.createElement("div");

        info.className = "history-info";

        const prompt =
            document.createElement("div");

        prompt.className = "history-prompt";
        prompt.textContent =
            item.prompt || "";

        const seed =
            document.createElement("div");

        seed.className = "history-seed";
        seed.textContent =
            `Seed: ${item.seed}`;

        info.appendChild(prompt);
        info.appendChild(seed);

        card.appendChild(image);
        card.appendChild(info);

        card.addEventListener(
            "click",
            () => {
                if (promptInput) {
                    promptInput.value =
                        item.prompt || "";
                }

                if (seedInput) {
                    seedInput.value =
                        item.seed ?? "";
                }

                if (resultImage) {
                    resultImage.src =
                        item.url;
                    resultImage.style.display =
                        "block";
                }

                if (resultPlaceholder) {
                    resultPlaceholder.style.display =
                        "none";
                }

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );

        historyGrid.appendChild(card);
    }
}

function clearHistory() {
    const history = getHistory();

    if (history.length === 0) {
        return;
    }

    if (
        !confirm(
            "生成履歴をすべて削除しますか？"
        )
    ) {
        return;
    }

    /*
     * object URLはページ内で作られたものなので、
     * ここではlocalStorageだけ消す。
     */
    localStorage.removeItem(HISTORY_KEY);

    if (historyGrid) {
        historyGrid.innerHTML = "";
    }

    console.log("生成履歴を削除しました。");
}


// ============================================================
// Quick prompts
// ============================================================

function setupQuickPrompts() {
    const buttons =
        document.querySelectorAll(
            "[data-prompt]"
        );

    buttons.forEach((button) => {
        button.addEventListener(
            "click",
            () => {
                const value =
                    button.dataset.prompt || "";

                if (promptInput) {
                    promptInput.value = value;
                    promptInput.focus();
                }
            }
        );
    });
}


// ============================================================
// Theme
// ============================================================

function setupTheme() {
    if (!themeButton) {
        return;
    }

    const saved =
        localStorage.getItem(
            "ai-image-generator-theme"
        );

    if (saved === "dark") {
        document.body.classList.add("dark");
    }

    themeButton.addEventListener(
        "click",
        () => {
            document.body.classList.toggle("dark");

            const dark =
                document.body.classList.contains(
                    "dark"
                );

            localStorage.setItem(
                "ai-image-generator-theme",
                dark ? "dark" : "light"
            );
        }
    );
}


// ============================================================
// Download
// ============================================================

function setupImageDownload() {
    if (!resultImage) {
        return;
    }

    resultImage.addEventListener(
        "contextmenu",
        () => {
            // 通常の右クリックを許可
        }
    );
}


// ============================================================
// Cleanup
// ============================================================

window.addEventListener(
    "beforeunload",
    async () => {
        try {
            if (generating) {
                currentAbortController?.abort();
            }

            if (modelLoaded) {
                await unloadModel(MODEL_ID);
            }
        } catch (error) {
            console.warn(
                "Model unload failed:",
                error
            );
        }
    }
);


// ============================================================
// Events
// ============================================================

function setupEvents() {
    generateButton?.addEventListener(
        "click",
        generate
    );

    cancelButton?.addEventListener(
        "click",
        cancelGeneration
    );

    clearHistoryButton?.addEventListener(
        "click",
        clearHistory
    );

    /*
     * Ctrl + Enterでも生成
     */
    promptInput?.addEventListener(
        "keydown",
        (event) => {
            if (
                event.ctrlKey &&
                event.key === "Enter"
            ) {
                event.preventDefault();

                if (
                    modelLoaded &&
                    !generating
                ) {
                    generate();
                }
            }
        }
    );
}


// ============================================================
// Start
// ============================================================

async function start() {
    console.log(
        "AI Image Generator starting..."
    );

    renderHistory();
    setupQuickPrompts();
    setupTheme();
    setupImageDownload();
    setupEvents();

    setStatus("起動中");
    setModelStatus("準備中");

    if (generateButton) {
        generateButton.disabled = true;
    }

    if (cancelButton) {
        cancelButton.disabled = true;
    }

    try {
        await initializeAI();
    } catch (error) {
        console.error(
            "Startup failed:",
            error
        );
    }
}

start();
