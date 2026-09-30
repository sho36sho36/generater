// ============================================================
// AI Image Generator
// GitHub Pages / WebGPU / SD-Turbo
// ============================================================

// web-txt2img の Direct API
//
// npm / Vite / Worker は使用しません。
// GitHub PagesからESM CDN経由で読み込みます。

import {
    detectCapabilities,
    loadModel,
    generateImage,
    unloadModel
} from "https://esm.sh/web-txt2img@0.1.0";


// ============================================================
// DOM
// ============================================================

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

const statusText =
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


// ============================================================
// 状態
// ============================================================

let modelLoaded = false;

let generating = false;

let currentImageURL = null;

let currentAbortController = null;


// ============================================================
// 定数
// ============================================================

const MODEL_ID =
    "sd-turbo";

const HISTORY_KEY =
    "ai-image-generator-history";


// ============================================================
// UI
// ============================================================

function setProgress(
    percent,
    message
) {

    let value =
        Number(percent);

    if (!Number.isFinite(value)) {
        value = 0;
    }

    value =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );


    progressBar.value =
        value;


    progressText.textContent =
        `${Math.round(value)}%`;


    if (message) {

        statusText.textContent =
            message;

    }

}


function setBadge(
    type,
    text
) {

    statusBadge.className =
        `badge ${type}`;

    statusBadge.textContent =
        text;

}


function setModelStatus(
    text
) {

    modelStatus.textContent =
        text;

}


// ============================================================
// WebGPU確認
// ============================================================

async function checkWebGPU() {

    if (!("gpu" in navigator)) {

        webgpuStatus.textContent =
            "利用不可";

        throw new Error(
            "このブラウザではWebGPUが利用できません。ChromeまたはEdgeなどのWebGPU対応ブラウザを使用してください。"
        );
    }


    const adapter =
        await navigator.gpu.requestAdapter();


    if (!adapter) {

        webgpuStatus.textContent =
            "利用不可";

        throw new Error(
            "WebGPUアダプターを取得できませんでした。"
        );
    }


    webgpuStatus.textContent =
        "利用可能";


    return true;
}


// ============================================================
// AI初期化
// ============================================================

async function initializeAI() {

    try {

        setBadge(
            "loading",
            "準備中"
        );


        generateButton.disabled =
            true;


        setModelStatus(
            "WebGPUを確認中..."
        );


        setProgress(
            0,
            "WebGPUを確認しています..."
        );


        // ----------------------------------------------------
        // WebGPU
        // ----------------------------------------------------

        await checkWebGPU();


        // ----------------------------------------------------
        // web-txt2img capabilities
        // ----------------------------------------------------

        setModelStatus(
            "WebGPU能力を確認中..."
        );


        setProgress(
            2,
            "AIエンジンを確認しています..."
        );


        const capabilities =
            await detectCapabilities();


        console.log(
            "Capabilities:",
            capabilities
        );


        if (!capabilities.webgpu) {

            throw new Error(
                "web-txt2imgからWebGPUが利用できないと判定されました。"
            );
        }


        // ----------------------------------------------------
        // モデルロード
        // ----------------------------------------------------

        setModelStatus(
            "SD-Turbo読み込み中..."
        );


        setProgress(
            3,
            "SD-Turboを読み込んでいます..."
        );


        const loadResult =
            await loadModel(
                MODEL_ID,
                {
                    backendPreference: [
                        "webgpu"
                    ],

                    onProgress:
                        handleModelProgress
                }
            );


        console.log(
            "Model load:",
            loadResult
        );


        if (
            !loadResult ||
            loadResult.ok === false
        ) {

            throw new Error(
                loadResult?.message ||
                loadResult?.reason ||
                "SD-Turboの読み込みに失敗しました。"
            );
        }


        // ----------------------------------------------------
        // 完了
        // ----------------------------------------------------

        modelLoaded =
            true;


        generateButton.disabled =
            false;


        setModelStatus(
            "SD-Turbo 準備完了"
        );


        setBadge(
            "ready",
            "準備完了"
        );


        setProgress(
            100,
            "AIモデルの準備が完了しました！"
        );


        console.log(
            "SD-Turbo ready."
        );


    } catch (error) {

        console.error(
            "Initialization error:",
            error
        );


        modelLoaded =
            false;


        generateButton.disabled =
            true;


        setBadge(
            "error",
            "エラー"
        );


        setModelStatus(
            "読み込み失敗"
        );


        setProgress(
            0,
            `エラー: ${error.message || error}`
        );

    }

}


// ============================================================
// モデル読み込み進捗
// ============================================================

function handleModelProgress(
    progress = {}
) {

    console.log(
        "MODEL:",
        progress
    );


    let pct =
        progress.pct;


    if (
        typeof pct !== "number"
    ) {

        pct = 0;

    }


    let message =
        progress.message ||
        "AIモデルを読み込んでいます...";


    // ダウンロード容量が取得できる場合
    if (
        typeof progress.bytesDownloaded === "number" &&
        typeof progress.totalBytesExpected === "number" &&
        progress.totalBytesExpected > 0
    ) {

        const downloaded =
            (
                progress.bytesDownloaded /
                1024 /
                1024
            ).toFixed(1);


        const total =
            (
                progress.totalBytesExpected /
                1024 /
                1024
            ).toFixed(1);


        message =
            `${message} ${downloaded} / ${total} MB`;

    }


    setProgress(
        pct,
        message
    );

}


// ============================================================
// 画像生成
// ============================================================

async function generateImageFromPrompt() {

    if (generating) {
        return;
    }


    if (!modelLoaded) {

        alert(
            "AIモデルの準備が完了していません。"
        );

        return;
    }


    const prompt =
        promptInput.value.trim();


    if (!prompt) {

        alert(
            "プロンプトを入力してください。"
        );

        return;
    }


    generating =
        true;


    generateButton.disabled =
        true;


    cancelButton.disabled =
        false;


    setProgress(
        0,
        "画像生成を開始しています..."
    );


    try {

        // ----------------------------------------------------
        // Seed
        // ----------------------------------------------------

        let seed;


        const seedText =
            seedInput.value.trim();


        if (seedText !== "") {

            const parsed =
                Number(seedText);


            if (
                !Number.isFinite(parsed)
            ) {

                throw new Error(
                    "Seedは数字で入力してください。"
                );
            }


            seed =
                Math.trunc(parsed);

        }


        // ----------------------------------------------------
        // Negative Prompt
        // ----------------------------------------------------

        const negativePrompt =
            negativePromptInput.value.trim();


        // SD-TurboのAPIではnegative promptが正式パラメータ
        // として公開されていないため、入力されている場合は
        // 通常プロンプトへ安全に連結します。

        let finalPrompt =
            prompt;


        if (negativePrompt) {

            finalPrompt +=
                `, avoid: ${negativePrompt}`;

        }


        // ----------------------------------------------------
        // Steps
        // ----------------------------------------------------

        const steps =
            Math.max(
                1,
                Math.min(
                    4,
                    Number(stepsInput.value) || 1
                )
            );


        console.log(
            "Prompt:",
            finalPrompt
        );


        console.log(
            "Seed:",
            seed
        );


        console.log(
            "Steps:",
            steps
        );


        // ----------------------------------------------------
        // Abort Controller
        // ----------------------------------------------------

        currentAbortController =
            new AbortController();


        // ----------------------------------------------------
        // Generation
        // ----------------------------------------------------

        const result =
            await generateImage({

                model:
                    MODEL_ID,

                prompt:
                    finalPrompt,

                seed:
                    seed,

                width:
                    512,

                height:
                    512,

                signal:
                    currentAbortController.signal,

                onProgress:
                    handleGenerationProgress

            });


        console.log(
            "Generation result:",
            result
        );


        // ----------------------------------------------------
        // エラー
        // ----------------------------------------------------

        if (
            !result ||
            result.ok === false
        ) {

            throw new Error(
                result?.message ||
                result?.reason ||
                "画像生成に失敗しました。"
            );
        }


        if (!result.blob) {

            throw new Error(
                "生成された画像データがありません。"
            );
        }


        // ----------------------------------------------------
        // 画像表示
        // ----------------------------------------------------

        if (currentImageURL) {

            URL.revokeObjectURL(
                currentImageURL
            );

        }


        currentImageURL =
            URL.createObjectURL(
                result.blob
            );


        resultImage.src =
            currentImageURL;


        resultImage.style.display =
            "block";


        resultPlaceholder.style.display =
            "none";


        downloadButton.disabled =
            false;


        setProgress(
            100,
            `生成完了！ ${Math.round(result.timeMs || 0)} ms`
        );


        // ----------------------------------------------------
        // 履歴
        // ----------------------------------------------------

        await addHistory(
            currentImageURL,
            prompt
        );


    } catch (error) {

        console.error(
            "Generation error:",
            error
        );


        if (
            error?.name ===
            "AbortError"
        ) {

            setProgress(
                0,
                "生成をキャンセルしました。"
            );

        } else {

            setProgress(
                0,
                `生成エラー: ${error.message || error}`
            );

        }

    } finally {

        generating =
            false;


        currentAbortController =
            null;


        generateButton.disabled =
            !modelLoaded;


        cancelButton.disabled =
            true;

    }

}


// ============================================================
// 生成進捗
// ============================================================

function handleGenerationProgress(
    progress = {}
) {

    console.log(
        "GENERATION:",
        progress
    );


    let pct =
        progress.pct;


    if (
        typeof pct !== "number"
    ) {

        pct = 0;

    }


    const phase =
        progress.phase ||
        "";


    const phaseNames = {

        tokenizing:
            "プロンプト解析中...",

        encoding:
            "テキスト解析中...",

        denoising:
            "画像を生成中...",

        decoding:
            "画像を変換中...",

        complete:
            "生成完了..."

    };


    const message =
        phaseNames[phase] ||
        `画像生成中... ${Math.round(pct)}%`;


    setProgress(
        pct,
        message
    );

}


// ============================================================
// キャンセル
// ============================================================

async function cancelGeneration() {

    if (
        !currentAbortController
    ) {

        return;
    }


    try {

        currentAbortController.abort();

    } catch (error) {

        console.warn(
            "Cancel error:",
            error
        );

    }


    currentAbortController =
        null;


    generating =
        false;


    generateButton.disabled =
        !modelLoaded;


    cancelButton.disabled =
        true;


    setProgress(
        0,
        "生成をキャンセルしました。"
    );

}


// ============================================================
// ダウンロード
// ============================================================

async function downloadImage() {

    if (!currentImageURL) {
        return;
    }


    try {

        const response =
            await fetch(
                currentImageURL
            );


        const blob =
            await response.blob();


        const url =
            URL.createObjectURL(
                blob
            );


        const a =
            document.createElement(
                "a"
            );


        a.href =
            url;


        a.download =
            `generated-${Date.now()}.png`;


        document.body.appendChild(
            a
        );


        a.click();


        a.remove();


        URL.revokeObjectURL(
            url
        );

    } catch (error) {

        console.error(
            "Download error:",
            error
        );

    }

}


// ============================================================
// 履歴
// ============================================================

async function addHistory(
    imageURL,
    prompt
) {

    try {

        const response =
            await fetch(
                imageURL
            );


        const blob =
            await response.blob();


        const reader =
            new FileReader();


        reader.onload =
            () => {

                const history =
                    getHistory();


                history.unshift({

                    image:
                        reader.result,

                    prompt:
                        prompt,

                    time:
                        Date.now()

                });


                // 最大6件
                history.splice(
                    6
                );


                try {

                    localStorage.setItem(
                        HISTORY_KEY,
                        JSON.stringify(history)
                    );

                } catch (storageError) {

                    console.warn(
                        "History storage error:",
                        storageError
                    );

                }


                renderHistory();

            };


        reader.readAsDataURL(
            blob
        );

    } catch (error) {

        console.warn(
            "History error:",
            error
        );

    }

}


function getHistory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                HISTORY_KEY
            ) || "[]"
        );

    } catch {

        return [];

    }

}


function renderHistory() {

    const history =
        getHistory();


    historyElement.innerHTML =
        "";


    if (
        history.length === 0
    ) {

        historyElement.innerHTML =
            "<p>まだ履歴はありません。</p>";

        return;

    }


    for (
        const item of history
    ) {

        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.className =
            "history-item";


        const img =
            document.createElement(
                "img"
            );


        img.src =
            item.image;


        img.alt =
            item.prompt;


        img.title =
            item.prompt;


        wrapper.appendChild(
            img
        );


        historyElement.appendChild(
            wrapper
        );

    }

}


// ============================================================
// 履歴削除
// ============================================================

clearHistoryButton.addEventListener(
    "click",
    () => {

        localStorage.removeItem(
            HISTORY_KEY
        );


        renderHistory();

    }
);


// ============================================================
// クイックプロンプト
// ============================================================

document
    .querySelectorAll(
        ".quick-prompt"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    promptInput.value =
                        button.dataset.prompt;


                    promptInput.focus();

                }
            );

        }
    );


// ============================================================
// テーマ
// ============================================================

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


        themeButton.textContent =
            dark
                ? "☀️"
                : "🌙";


        localStorage.setItem(
            "theme",
            dark
                ? "dark"
                : "light"
        );

    }
);


if (
    localStorage.getItem(
        "theme"
    ) === "dark"
) {

    document.body.classList.add(
        "dark"
    );


    themeButton.textContent =
        "☀️";

}


// ============================================================
// イベント
// ============================================================

generateButton.addEventListener(
    "click",
    generateImageFromPrompt
);


cancelButton.addEventListener(
    "click",
    cancelGeneration
);


downloadButton.addEventListener(
    "click",
    downloadImage
);


// ============================================================
// 起動
// ============================================================

renderHistory();

initializeAI();
