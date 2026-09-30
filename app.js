import {
    detectCapabilities,
    loadModel,
    generateImage,
    unloadModel
} from "https://cdn.jsdelivr.net/npm/web-txt2img@0.3.1/dist/index.js";


/* =========================================================
   AI Image Generator
   GitHub Pages
   WebGPU + SD-Turbo
   Direct API version
   ========================================================= */


/* =========================================================
   DOM
   ========================================================= */

const promptInput =
    document.getElementById("prompt");

const negativePromptInput =
    document.getElementById("negativePrompt");

const seedInput =
    document.getElementById("seed");

const stepsInput =
    document.getElementById("steps");

const generateButton =
    document.getElementById("generate");

const cancelButton =
    document.getElementById("cancel");

const downloadButton =
    document.getElementById("downloadButton");

const clearHistoryButton =
    document.getElementById("clearHistory");

const themeButton =
    document.getElementById("themeButton");

const progressBar =
    document.getElementById("progressBar");

const progressText =
    document.getElementById("progressText");

const statusElement =
    document.getElementById("status");

const statusBadge =
    document.getElementById("statusBadge");

const webgpuStatus =
    document.getElementById("webgpuStatus");

const modelStatus =
    document.getElementById("modelStatus");

const resultImage =
    document.getElementById("resultImage");

const resultPlaceholder =
    document.getElementById("resultPlaceholder");

const historyElement =
    document.getElementById("history");


/* =========================================================
   State
   ========================================================= */

let modelLoaded = false;
let generating = false;

let currentImageURL = null;

let currentAbortController = null;


/* =========================================================
   Constants
   ========================================================= */

const HISTORY_KEY =
    "ai-image-generator-history";

const THEME_KEY =
    "ai-image-generator-theme";


/* =========================================================
   Progress
   ========================================================= */

function setProgress(percent, text = null) {

    let value = Number(percent);

    if (!Number.isFinite(value)) {
        value = 0;
    }

    value = Math.max(
        0,
        Math.min(100, value)
    );

    if (progressBar) {
        progressBar.value = value;

        /*
         * Some versions of the UI use a progress element,
         * while others use a styled div.
         */
        if (
            progressBar.style &&
            progressBar.tagName !== "PROGRESS"
        ) {
            progressBar.style.width =
                `${value}%`;
        }
    }

    if (progressText) {
        progressText.textContent =
            text !== null
                ? text
                : `${Math.round(value)}%`;
    }
}


/* =========================================================
   Status
   ========================================================= */

function setStatus(
    message,
    type = "loading"
) {

    if (statusElement) {
        statusElement.textContent = message;
    }

    if (!statusBadge) {
        return;
    }

    statusBadge.className =
        "status-badge";

    if (type === "ready") {

        statusBadge.textContent =
            "準備完了";

        statusBadge.classList.add(
            "success"
        );

    } else if (type === "generating") {

        statusBadge.textContent =
            "生成中";

        statusBadge.classList.add(
            "generating"
        );

    } else if (type === "error") {

        statusBadge.textContent =
            "エラー";

        statusBadge.classList.add(
            "error"
        );

    } else {

        statusBadge.textContent =
            "準備中";
    }
}


/* =========================================================
   Button state
   ========================================================= */

function updateButtons() {

    if (generateButton) {

        generateButton.disabled =
            generating ||
            !modelLoaded;
    }

    if (cancelButton) {

        cancelButton.disabled =
            !generating;
    }

    if (downloadButton) {

        downloadButton.disabled =
            !currentImageURL;
    }
}


/* =========================================================
   Seed
   ========================================================= */

function randomSeed() {

    return Math.floor(
        Math.random() * 2147483647
    );
}


function getSeed() {

    const value =
        Number(seedInput?.value);

    if (
        Number.isInteger(value) &&
        value >= 0
    ) {
        return value;
    }

    return randomSeed();
}


/* =========================================================
   WebGPU detection
   ========================================================= */

async function checkWebGPU() {

    if (!navigator.gpu) {

        throw new Error(
            "このブラウザではWebGPUが利用できません。"
        );
    }

    const adapter =
        await navigator.gpu.requestAdapter();

    if (!adapter) {

        throw new Error(
            "WebGPU GPUアダプターを取得できませんでした。"
        );
    }

    return adapter;
}


/* =========================================================
   AI initialization
   ========================================================= */

async function initializeAI() {

    try {

        setStatus(
            "WebGPUを確認しています...",
            "loading"
        );

        setProgress(
            0,
            "0%"
        );

        if (webgpuStatus) {

            webgpuStatus.textContent =
                "確認中...";
        }

        if (modelStatus) {

            modelStatus.textContent =
                "読み込み前";
        }


        /* -----------------------------------------
           Native WebGPU check
           ----------------------------------------- */

        await checkWebGPU();


        /* -----------------------------------------
           web-txt2img capability check
           ----------------------------------------- */

        const capabilities =
            await detectCapabilities();

        console.log(
            "web-txt2img capabilities:",
            capabilities
        );


        if (!capabilities?.webgpu) {

            throw new Error(
                "web-txt2imgからWebGPUを利用できません。"
            );
        }


        if (webgpuStatus) {

            webgpuStatus.textContent =
                "利用可能";
        }


        /* -----------------------------------------
           Load SD-Turbo
           ----------------------------------------- */

        if (modelStatus) {

            modelStatus.textContent =
                "SD-Turbo読み込み中...";
        }

        setStatus(
            "AIモデルを読み込んでいます...",
            "loading"
        );

        setProgress(
            0,
            "モデル読み込み中... 0%"
        );


        const loadResult =
            await loadModel(
                "sd-turbo",
                {
                    backendPreference: [
                        "webgpu"
                    ]
                }
            );


        console.log(
            "SD-Turbo load result:",
            loadResult
        );


        if (
            loadResult &&
            loadResult.ok === false
        ) {

            throw new Error(
                loadResult.message ||
                "SD-Turboの読み込みに失敗しました。"
            );
        }


        /* -----------------------------------------
           Ready
           ----------------------------------------- */

        modelLoaded = true;

        if (modelStatus) {

            modelStatus.textContent =
                "SD-Turbo準備完了";
        }

        setProgress(
            100,
            "100%"
        );

        setStatus(
            "AIモデルの準備が完了しました",
            "ready"
        );

        updateButtons();

        console.log(
            "SD-Turbo is ready."
        );

    } catch (error) {

        console.error(
            "AI initialization failed:",
            error
        );

        modelLoaded = false;

        if (webgpuStatus) {

            webgpuStatus.textContent =
                "利用できません";
        }

        if (modelStatus) {

            modelStatus.textContent =
                "読み込み失敗";
        }

        setProgress(
            0,
            "読み込みに失敗しました"
        );

        setStatus(
            `AIモデルを読み込めませんでした: ${error.message}`,
            "error"
        );

        updateButtons();
    }
}


/* =========================================================
   Generate image
   ========================================================= */

async function generateImageFromPrompt() {

    if (generating) {
        return;
    }

    if (!modelLoaded) {

        setStatus(
            "AIモデルがまだ準備できていません。",
            "error"
        );

        return;
    }


    const prompt =
        promptInput?.value.trim() || "";


    if (!prompt) {

        setStatus(
            "プロンプトを入力してください。",
            "error"
        );

        promptInput?.focus();

        return;
    }


    const seed =
        getSeed();


    if (seedInput) {

        seedInput.value =
            seed;
    }


    generating = true;

    updateButtons();


    setStatus(
        "画像を生成しています...",
        "generating"
    );

    setProgress(
        0,
        "生成開始..."
    );


    if (resultPlaceholder) {

        resultPlaceholder.style.display =
            "none";
    }


    if (resultImage) {

        resultImage.style.display =
            "none";
    }


    /*
     * Previous image URL is no longer needed.
     */
    if (currentImageURL) {

        URL.revokeObjectURL(
            currentImageURL
        );

        currentImageURL =
            null;
    }


    /*
     * Direct API supports AbortController.
     */
    currentAbortController =
        new AbortController();


    try {

        console.log(
            "Generating image:",
            {
                prompt,
                seed
            }
        );


        const result =
            await generateImage({

                model: "sd-turbo",

                prompt,

                seed,

                width: 512,

                height: 512,

                signal:
                    currentAbortController.signal,

                onProgress: event => {

                    console.log(
                        "Generation progress:",
                        event
                    );


                    let percent = null;


                    if (
                        typeof event?.pct ===
                        "number"
                    ) {

                        percent =
                            event.pct;
                    }


                    if (
                        percent === null &&
                        typeof event?.progress ===
                        "number"
                    ) {

                        percent =
                            event.progress;
                    }


                    /*
                     * Normalize 0-1 to 0-100.
                     */
                    if (
                        percent !== null &&
                        percent >= 0 &&
                        percent <= 1
                    ) {

                        percent *= 100;
                    }


                    if (
                        percent !== null
                    ) {

                        setProgress(
                            percent,
                            `生成中... ${Math.round(percent)}%`
                        );

                    } else if (
                        event?.phase
                    ) {

                        setStatus(
                            `画像を生成しています... ${event.phase}`,
                            "generating"
                        );
                    }
                }
            });


        console.log(
            "Generation result:",
            result
        );


        /*
         * Cancelled.
         */
        if (
            result?.ok === false &&
            (
                result.reason ===
                "cancelled" ||
                result.reason ===
                "aborted"
            )
        ) {

            setStatus(
                "画像生成をキャンセルしました。",
                "loading"
            );

            setProgress(
                0,
                "キャンセルしました"
            );

            return;
        }


        /*
         * Failed.
         */
        if (
            result?.ok === false
        ) {

            throw new Error(
                result.message ||
                `画像生成に失敗しました: ${result.reason || "unknown"}`
            );
        }


        /*
         * Blob -> Object URL
         */
        if (!result?.blob) {

            throw new Error(
                "画像データを取得できませんでした。"
            );
        }


        currentImageURL =
            URL.createObjectURL(
                result.blob
            );


        /* -----------------------------------------
           Display
           ----------------------------------------- */

        if (resultImage) {

            resultImage.src =
                currentImageURL;

            resultImage.style.display =
                "block";
        }


        if (resultPlaceholder) {

            resultPlaceholder.style.display =
                "none";
        }


        if (downloadButton) {

            downloadButton.disabled =
                false;
        }


        setProgress(
            100,
            "100%"
        );


        setStatus(
            "画像の生成が完了しました",
            "ready"
        );


        /* -----------------------------------------
           History
           ----------------------------------------- */

        addHistoryItem({

            prompt,

            seed,

            image:
                currentImageURL,

            createdAt:
                Date.now()
        });


        saveHistoryMetadata({

            prompt,

            seed,

            createdAt:
                Date.now()
        });


        console.log(
            "Generation completed.",
            result.timeMs
                ? `${Math.round(result.timeMs)} ms`
                : ""
        );

    } catch (error) {

        console.error(
            "Generation error:",
            error
        );


        if (
            error?.name ===
            "AbortError" ||
            error?.message
                ?.toLowerCase()
                .includes("abort")
        ) {

            setStatus(
                "画像生成をキャンセルしました。",
                "loading"
            );

            setProgress(
                0,
                "キャンセルしました"
            );

        } else {

            setStatus(
                `画像生成に失敗しました: ${error.message}`,
                "error"
            );

            setProgress(
                0,
                "生成失敗"
            );
        }

    } finally {

        generating = false;

        currentAbortController =
            null;

        updateButtons();
    }
}


/* =========================================================
   Cancel
   ========================================================= */

function cancelGeneration() {

    if (!generating) {
        return;
    }


    if (
        currentAbortController
    ) {

        console.log(
            "Cancelling generation..."
        );

        currentAbortController.abort();
    }


    setStatus(
        "画像生成をキャンセルしています...",
        "loading"
    );

    setProgress(
        0,
        "キャンセル中..."
    );
}


/* =========================================================
   Download
   ========================================================= */

function downloadCurrentImage() {

    if (!currentImageURL) {
        return;
    }


    const link =
        document.createElement("a");


    link.href =
        currentImageURL;


    link.download =
        `ai-image-${Date.now()}.png`;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();
}


/* =========================================================
   History metadata
   ========================================================= */

function loadHistoryMetadata() {

    try {

        const raw =
            localStorage.getItem(
                HISTORY_KEY
            );


        if (!raw) {
            return [];
        }


        const data =
            JSON.parse(raw);


        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.warn(
            "History load failed:",
            error
        );

        return [];
    }
}


function saveHistoryMetadata(item) {

    try {

        const history =
            loadHistoryMetadata();


        history.unshift(item);


        const trimmed =
            history.slice(0, 30);


        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(trimmed)
        );

    } catch (error) {

        console.warn(
            "History save failed:",
            error
        );
    }
}


/* =========================================================
   Visible history
   ========================================================= */

function addHistoryItem(item) {

    if (!historyElement) {
        return;
    }


    const card =
        document.createElement("div");

    card.className =
        "history-item";


    const image =
        document.createElement("img");

    image.src =
        item.image;

    image.alt =
        item.prompt;

    image.loading =
        "lazy";


    const text =
        document.createElement("div");

    text.className =
        "history-prompt";

    text.textContent =
        item.prompt;


    const seed =
        document.createElement("div");

    seed.className =
        "history-seed";

    seed.textContent =
        `Seed: ${item.seed}`;


    card.appendChild(
        image
    );

    card.appendChild(
        text
    );

    card.appendChild(
        seed
    );


    historyElement.prepend(
        card
    );


    /*
     * Keep visible history small.
     */
    while (
        historyElement.children.length >
        20
    ) {

        historyElement.lastElementChild
            ?.remove();
    }
}


/* =========================================================
   Clear history
   ========================================================= */

function clearHistory() {

    try {

        localStorage.removeItem(
            HISTORY_KEY
        );

    } catch (error) {

        console.warn(
            "History clear failed:",
            error
        );
    }


    if (historyElement) {

        historyElement.innerHTML =
            "";
    }
}


/* =========================================================
   Quick prompts
   ========================================================= */

function setupQuickPrompts() {

    const buttons =
        document.querySelectorAll(
            "[data-prompt]"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const value =
                    button.dataset.prompt;


                if (
                    !value ||
                    !promptInput
                ) {
                    return;
                }


                promptInput.value =
                    value;


                promptInput.focus();
            }
        );
    });
}


/* =========================================================
   Theme
   ========================================================= */

function setupTheme() {

    if (!themeButton) {
        return;
    }


    themeButton.addEventListener(
        "click",
        () => {

            document.body.classList.toggle(
                "dark"
            );


            const dark =
                document.body.classList.contains(
                    "dark"
                );


            localStorage.setItem(
                THEME_KEY,
                dark
                    ? "dark"
                    : "light"
            );
        }
    );


    const saved =
        localStorage.getItem(
            THEME_KEY
        );


    if (saved === "dark") {

        document.body.classList.add(
            "dark"
        );
    }
}


/* =========================================================
   Events
   ========================================================= */

function setupEvents() {

    generateButton?.addEventListener(
        "click",
        generateImageFromPrompt
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
     * Ctrl + Enter
     */
    promptInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.ctrlKey &&
                event.key === "Enter"
            ) {

                event.preventDefault();


                if (
                    !generating &&
                    modelLoaded
                ) {

                    generateImageFromPrompt();
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


    if (generateButton) {

        generateButton.disabled =
            true;
    }


    if (cancelButton) {

        cancelButton.disabled =
            true;
    }


    if (downloadButton) {

        downloadButton.disabled =
            true;
    }


    setupTheme();

    setupEvents();

    setupQuickPrompts();


    /*
     * Initial seed
     */
    if (seedInput) {

        const value =
            Number(seedInput.value);


        if (
            !Number.isInteger(value)
        ) {

            seedInput.value =
                randomSeed();
        }
    }


    /*
     * Existing metadata
     */
    const history =
        loadHistoryMetadata();


    console.log(
        `保存されている生成履歴: ${history.length}件`
    );


    /*
     * Start AI
     */
    await initializeAI();
}


/* =========================================================
   Global errors
   ========================================================= */

window.addEventListener(
    "error",
    event => {

        console.error(
            "Global error:",
            event.error ||
            event.message
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


/* =========================================================
   Start
   ========================================================= */

start();
