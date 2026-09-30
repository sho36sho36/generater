import {
    Txt2ImgWorkerClient
} from "web-txt2img";


const promptInput =
    document.getElementById("prompt");

const negativePromptInput =
    document.getElementById("negativePrompt");

const seedInput =
    document.getElementById("seed");

const stepsInput =
    document.getElementById("steps");

const generateButton =
    document.getElementById("generateButton");

const cancelButton =
    document.getElementById("cancelButton");

const regenerateButton =
    document.getElementById("regenerateButton");

const downloadButton =
    document.getElementById("downloadButton");

const randomSeedButton =
    document.getElementById("randomSeed");

const resultImage =
    document.getElementById("resultImage");

const emptyState =
    document.getElementById("emptyState");

const loading =
    document.getElementById("loading");

const loadingText =
    document.getElementById("loadingText");

const status =
    document.getElementById("status");

const resultInfo =
    document.getElementById("resultInfo");

const progressContainer =
    document.getElementById("progressContainer");

const progressBar =
    document.getElementById("progressBar");

const progressText =
    document.getElementById("progressText");

const progressPercent =
    document.getElementById("progressPercent");

const gpuStatus =
    document.getElementById("gpuStatus");

const historyElement =
    document.getElementById("history");

const clearHistoryButton =
    document.getElementById("clearHistory");

const themeButton =
    document.getElementById("themeButton");


let client = null;

let currentAbort = null;

let currentImageURL = null;

let lastOptions = null;


/*
 * ---------------------------------
 * テーマ
 * ---------------------------------
 */

function loadTheme() {

    const theme =
        localStorage.getItem(
            "dreamcanvas-theme"
        );

    if (theme === "dark") {
        document.body.classList.add("dark");
    }
}


themeButton.addEventListener(
    "click",
    () => {

        document.body.classList.toggle(
            "dark"
        );

        localStorage.setItem(
            "dreamcanvas-theme",
            document.body.classList.contains("dark")
                ? "dark"
                : "light"
        );
    }
);


/*
 * ---------------------------------
 * Progress
 * ---------------------------------
 */

function setProgress(progress = {}) {

    const pct =
        typeof progress.pct === "number"
            ? Math.max(
                0,
                Math.min(
                    100,
                    progress.pct
                )
            )
            : null;


    if (pct !== null) {

        progressBar.style.width =
            `${pct}%`;

        progressPercent.textContent =
            `${Math.round(pct)}%`;
    }


    let message =
        progress.message ||
        progress.phase ||
        "処理中...";


    if (
        progress.bytesDownloaded != null &&
        progress.totalBytesExpected != null
    ) {

        const downloaded =
            progress.bytesDownloaded /
            1024 /
            1024;

        const total =
            progress.totalBytesExpected /
            1024 /
            1024;

        message +=
            ` (${downloaded.toFixed(1)} / ${total.toFixed(1)} MB)`;
    }


    progressText.textContent =
        message;

    loadingText.textContent =
        message;
}


/*
 * ---------------------------------
 * WebGPU
 * ---------------------------------
 */

async function initialize() {

    loadTheme();

    try {

        client =
            Txt2ImgWorkerClient.createDefault();


        const caps =
            await client.detect();


        if (caps.webgpu) {

            gpuStatus.innerHTML = `
                <span class="status-dot ok"></span>
                WebGPU利用可能
            `;

            status.textContent =
                "WebGPUを利用できます。";


        } else {

            gpuStatus.innerHTML = `
                <span class="status-dot error"></span>
                WebGPU未対応
            `;

            status.textContent =
                "WebGPUに対応したブラウザが必要です。";

            generateButton.disabled =
                true;
        }


    } catch (error) {

        console.error(error);

        gpuStatus.innerHTML = `
            <span class="status-dot error"></span>
            確認失敗
        `;

        status.textContent =
            "WebGPUの確認に失敗しました。";

        generateButton.disabled =
            true;
    }


    renderHistory();
}


/*
 * ---------------------------------
 * Model Loading
 * ---------------------------------
 */

async function loadModel() {

    setProgress({
        pct: 0,
        message: "AIモデルを準備しています..."
    });


    progressContainer.classList.remove(
        "hidden"
    );


    const result =
        await client.load(
            "sd-turbo",
            {
                backendPreference: [
                    "webgpu"
                ]
            },
            setProgress
        );


    if (!result?.ok) {

        throw new Error(
            result?.message ||
            "AIモデルの読み込みに失敗しました。"
        );
    }


    setProgress({
        pct: 100,
        message: "AIモデルの準備完了"
    });


    return result;
}


/*
 * ---------------------------------
 * Generate
 * ---------------------------------
 */

async function generate() {

    const prompt =
        promptInput.value.trim();


    if (!prompt) {

        status.textContent =
            "プロンプトを入力してください。";

        promptInput.focus();

        return;
    }


    if (!client) {

        status.textContent =
            "AIエンジンを初期化しています。";

        return;
    }


    if (!navigator.gpu) {

        status.textContent =
            "このブラウザではWebGPUを利用できません。";

        return;
    }


    const seed =
        Number(seedInput.value);


    lastOptions = {

        prompt,

        negativePrompt:
            negativePromptInput.value.trim(),

        seed:
            Number.isFinite(seed)
                ? seed
                : Math.floor(
                    Math.random() * 2147483647
                ),

        steps:
            Number(stepsInput.value)
    };


    generateButton.disabled =
        true;

    regenerateButton.disabled =
        true;

    cancelButton.classList.remove(
        "hidden"
    );

    loading.classList.remove(
        "hidden"
    );

    emptyState.style.display =
        "none";

    progressContainer.classList.remove(
        "hidden"
    );


    try {

        /*
         * 初回だけモデルを読み込む。
         */

        if (!client._dreamCanvasLoaded) {

            status.textContent =
                "初回起動：AIモデルを読み込んでいます...";

            await loadModel();

            client._dreamCanvasLoaded =
                true;
        }


        status.textContent =
            "画像を生成しています...";


        setProgress({
            pct: 0,
            message: "生成開始..."
        });


        /*
         * SD-Turboは512x512。
         */

        const request = {

            prompt:
                lastOptions.prompt,

            seed:
                lastOptions.seed,

            width: 512,

            height: 512
        };


        /*
         * ネガティブプロンプトは
         * 現在のSD-Turbo APIの
         * 基本パラメータには含まれないため、
         * ここではpromptだけを渡します。
         */

        const generated =
            client.generate(
                request,

                event => {

                    setProgress({
                        ...event,

                        message:
                            `生成: ${
                                event.phase ||
                                event.message ||
                                "処理中"
                            }`
                    });
                },

                {
                    busyPolicy:
                        "queue",

                    debounceMs:
                        100
                }
            );


        currentAbort =
            generated.abort;


        const result =
            await generated.promise;


        currentAbort =
            null;


        if (!result?.ok) {

            throw new Error(
                result?.message ||
                result?.reason ||
                "画像生成に失敗しました。"
            );
        }


        /*
         * 古いBlob URLを解放。
         */

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


        resultInfo.textContent =
            `512 × 512 / Seed ${lastOptions.seed}`;


        downloadButton.disabled =
            false;

        regenerateButton.disabled =
            false;


        status.textContent =
            `生成完了 ${
                Math.round(
                    result.timeMs || 0
                )
            } ms`;


        saveHistory(
            currentImageURL,
            lastOptions
        );


        renderHistory();


    } catch (error) {

        console.error(
            "Generation error:",
            error
        );


        status.textContent =
            `エラー: ${
                error.message ||
                error
            }`;


    } finally {

        currentAbort =
            null;

        generateButton.disabled =
            false;

        cancelButton.classList.add(
            "hidden"
        );

        loading.classList.add(
            "hidden"
        );

        progressContainer.classList.add(
            "hidden"
        );
    }
}


generateButton.addEventListener(
    "click",
    generate
);


regenerateButton.addEventListener(
    "click",
    generate
);


/*
 * Ctrl + Enter
 */

promptInput.addEventListener(
    "keydown",
    event => {

        if (
            event.ctrlKey &&
            event.key === "Enter"
        ) {

            generate();
        }
    }
);


/*
 * ---------------------------------
 * Cancel
 * ---------------------------------
 */

cancelButton.addEventListener(
    "click",
    async () => {

        if (!currentAbort) {
            return;
        }


        try {

            await currentAbort();

        } catch (error) {

            console.warn(
                "Abort error:",
                error
            );
        }


        currentAbort =
            null;

        status.textContent =
            "生成を中止しました。";

        cancelButton.classList.add(
            "hidden"
        );

        loading.classList.add(
            "hidden"
        );

        generateButton.disabled =
            false;
    }
);


/*
 * ---------------------------------
 * Random Seed
 * ---------------------------------
 */

randomSeedButton.addEventListener(
    "click",
    () => {

        seedInput.value =
            Math.floor(
                Math.random() *
                2147483647
            );
    }
);


/*
 * ---------------------------------
 * Download
 * ---------------------------------
 */

downloadButton.addEventListener(
    "click",
    () => {

        if (!currentImageURL) {
            return;
        }


        const link =
            document.createElement("a");


        const safeName =
            (
                lastOptions?.prompt ||
                "generated-image"
            )
                .replace(
                    /[\\/:*?"<>|]/g,
                    "_"
                )
                .slice(
                    0,
                    50
                );


        link.href =
            currentImageURL;

        link.download =
            `${safeName}.png`;

        link.click();
    }
);


/*
 * ---------------------------------
 * Quick Prompts
 * ---------------------------------
 */

document
    .querySelectorAll(
        ".quick-prompts button"
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


/*
 * ---------------------------------
 * History
 * ---------------------------------
 */

async function saveHistory(
    imageURL,
    options
) {

    try {

        const response =
            await fetch(imageURL);

        const blob =
            await response.blob();


        const reader =
            new FileReader();


        reader.onload = () => {

            const item = {

                image:
                    reader.result,

                prompt:
                    options.prompt,

                seed:
                    options.seed,

                date:
                    Date.now()
            };


            let history =
                getHistory();


            history.unshift(
                item
            );


            history =
                history.slice(
                    0,
                    8
                );


            try {

                localStorage.setItem(
                    "dreamcanvas-history",
                    JSON.stringify(history)
                );

            } catch {

                /*
                 * 容量不足なら
                 * 古い履歴を削る。
                 */

                history =
                    history.slice(
                        0,
                        3
                    );


                try {

                    localStorage.setItem(
                        "dreamcanvas-history",
                        JSON.stringify(history)
                    );

                } catch {
                    console.warn(
                        "履歴を保存できませんでした。"
                    );
                }
            }
        };


        reader.readAsDataURL(
            blob
        );

    } catch (error) {

        console.warn(
            "History save failed:",
            error
        );
    }
}


function getHistory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "dreamcanvas-history"
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


    if (!history.length) {

        historyElement.innerHTML = `
            <div class="history-empty">
                生成履歴はありません
            </div>
        `;

        return;
    }


    for (
        const item of history
    ) {

        const element =
            document.createElement(
                "div"
            );


        element.className =
            "history-item";


        element.innerHTML = `
            <img
                src="${item.image}"
                alt="生成画像"
            >

            <div class="history-item-info">
                ${escapeHTML(item.prompt)}
            </div>
        `;


        element.addEventListener(
            "click",
            () => {

                resultImage.src =
                    item.image;

                resultImage.style.display =
                    "block";

                emptyState.style.display =
                    "none";

                resultInfo.textContent =
                    `512 × 512 / Seed ${item.seed}`;

                downloadButton.disabled =
                    false;

                promptInput.value =
                    item.prompt;

                seedInput.value =
                    item.seed;

                lastOptions = {
                    prompt:
                        item.prompt,

                    seed:
                        item.seed,

                    steps:
                        1
                };


                status.textContent =
                    "履歴から読み込みました";
            }
        );


        historyElement.appendChild(
            element
        );
    }
}


clearHistoryButton.addEventListener(
    "click",
    () => {

        if (
            !confirm(
                "生成履歴をすべて削除しますか？"
            )
        ) {
            return;
        }


        localStorage.removeItem(
            "dreamcanvas-history"
        );


        renderHistory();


        status.textContent =
            "履歴を削除しました";
    }
);


/*
 * ---------------------------------
 * HTML Escape
 * ---------------------------------
 */

function escapeHTML(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );
}


/*
 * ---------------------------------
 * Start
 * ---------------------------------
 */

initialize();
