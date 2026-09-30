import { Txt2ImgWorkerClient } from "web-txt2img";
import { env } from "@xenova/transformers";


// ============================================================
// Transformers.js設定
// ============================================================

env.allowLocalModels = false;
env.allowRemoteModels = true;

env.remoteHost = "https://huggingface.co/";
env.remotePathTemplate = "{model}/resolve/{revision}/";

env.useBrowserCache = true;


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

let client = null;

let modelLoaded = false;

let generating = false;

let currentAbort = null;

let currentImageURL = null;


// ============================================================
// UI
// ============================================================

function setProgress(percent, message) {

    const value =
        Math.max(
            0,
            Math.min(
                100,
                Number(percent) || 0
            )
        );

    progressBar.value = value;

    progressText.textContent =
        `${Math.round(value)}%`;

    if (message) {
        statusText.textContent =
            message;
    }
}


function setBadge(type, text) {

    statusBadge.className =
        `badge ${type}`;

    statusBadge.textContent =
        text;
}


function setModelStatus(text) {

    modelStatus.textContent =
        text;
}


// ============================================================
// WebGPU
// ============================================================

async function checkWebGPU() {

    if (!("gpu" in navigator)) {

        webgpuStatus.textContent =
            "利用不可";

        throw new Error(
            "このブラウザではWebGPUが利用できません。"
        );
    }

    try {

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

    } catch (error) {

        webgpuStatus.textContent =
            "エラー";

        throw error;
    }
}


// ============================================================
// AIモデル初期化
// ============================================================

async function initializeAI() {

    try {

        setBadge(
            "loading",
            "準備中"
        );

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


        setModelStatus(
            "AIモデル読み込み中..."
        );

        setProgress(
            0,
            "AIモデルを読み込んでいます..."
        );


        // ----------------------------------------------------
        // Worker Client
        // ----------------------------------------------------

        client =
            Txt2ImgWorkerClient.createDefault();


        // ----------------------------------------------------
        // capability detection
        // ----------------------------------------------------

        const caps =
            await client.detect();

        console.log(
            "WebGPU capabilities:",
            caps
        );


        if (!caps.webgpu) {

            throw new Error(
                "web-txt2imgからWebGPUが利用できないと判定されました。"
            );
        }


        // ----------------------------------------------------
        // SD-Turboロード
        // ----------------------------------------------------

        console.log(
            "Loading SD-Turbo..."
        );


        const loadResult =
            await client.load(
                "sd-turbo",
                {
                    backendPreference: [
                        "webgpu"
                    ]
                },
                (progress) => {

                    console.log(
                        "MODEL LOAD:",
                        progress
                    );


                    if (
                        progress &&
                        typeof progress.pct === "number"
                    ) {

                        setProgress(
                            progress.pct,
                            progress.message ||
                            `AIモデル読み込み中... ${Math.round(progress.pct)}%`
                        );

                    } else {

                        setProgress(
                            0,
                            progress?.message ||
                            "AIモデルを読み込んでいます..."
                        );
                    }
                }
            );


        console.log(
            "Model load result:",
            loadResult
        );


        if (
            !loadResult ||
            loadResult.ok === false
        ) {

            throw new Error(
                loadResult?.message ||
                loadResult?.reason ||
                "AIモデルの読み込みに失敗しました。"
            );
        }


        // ----------------------------------------------------
        // 完了
        // ----------------------------------------------------

        modelLoaded = true;

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


        modelLoaded = false;

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
// 画像生成
// ============================================================

async function generateImage() {

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


    generating = true;

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

            seed = parsed;
        }


        console.log(
            "Prompt:",
            prompt
        );

        console.log(
            "Seed:",
            seed
        );


        // ----------------------------------------------------
        // Generate
        // ----------------------------------------------------

        const request =
            client.generate(
                {
                    prompt: prompt,

                    seed: seed,

                    width: 512,

                    height: 512
                },

                (progress) => {

                    console.log(
                        "GENERATION:",
                        progress
                    );


                    if (
                        progress &&
                        typeof progress.pct === "number"
                    ) {

                        setProgress(
                            progress.pct,
                            progress.phase
                                ? `生成中: ${progress.phase}`
                                : `画像生成中... ${Math.round(progress.pct)}%`
                        );

                    } else {

                        setProgress(
                            0,
                            progress?.phase
                                ? `生成中: ${progress.phase}`
                                : "画像生成中..."
                        );
                    }
                }
            );


        currentAbort =
            request.abort;


        // ----------------------------------------------------
        // 完了待ち
        // ----------------------------------------------------

        const result =
            await request.promise;


        console.log(
            "Generation result:",
            result
        );


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


        // ----------------------------------------------------
        // Blob
        // ----------------------------------------------------

        if (!result.blob) {

            throw new Error(
                "生成された画像データがありません。"
            );
        }


        // 古いURLを解放
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
            `生成完了！`
        );


        // 履歴
        await addHistory(
            currentImageURL,
            prompt
        );


    } catch (error) {

        console.error(
            "Generation error:",
            error
        );


        setProgress(
            0,
            `生成エラー: ${error.message || error}`
        );


    } finally {

        generating = false;

        currentAbort = null;

        generateButton.disabled =
            !modelLoaded;

        cancelButton.disabled =
            true;
    }
}


// ============================================================
// キャンセル
// ============================================================

async function cancelGeneration() {

    if (!currentAbort) {
        return;
    }


    try {

        await currentAbort();

    } catch (error) {

        console.warn(
            "Cancel error:",
            error
        );
    }


    currentAbort = null;

    generating = false;

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


    const response =
        await fetch(
            currentImageURL
        );


    const blob =
        await response.blob();


    const url =
        URL.createObjectURL(blob);


    const a =
        document.createElement("a");


    a.href = url;

    a.download =
        `generated-${Date.now()}.png`;


    document.body.appendChild(a);

    a.click();

    a.remove();


    URL.revokeObjectURL(url);
}


// ============================================================
// 履歴
// ============================================================

const HISTORY_KEY =
    "ai-image-generator-history";


async function addHistory(
    imageURL,
    prompt
) {

    try {

        const response =
            await fetch(imageURL);

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


                localStorage.setItem(
                    HISTORY_KEY,
                    JSON.stringify(history)
                );


                renderHistory();
            };


        reader.readAsDataURL(blob);

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


    if (history.length === 0) {

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
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                promptInput.value =
                    button.dataset.prompt;

                promptInput.focus();
            }
        );
    });


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
    generateImage
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
