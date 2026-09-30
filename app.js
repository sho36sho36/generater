/*

* AI Image Generator
* GitHub Pages / WebGPU / SD-Turbo
*
* npm・Vite不要
  */

import {
Txt2ImgWorkerClient
} from "https://cdn.jsdelivr.net/npm/web-txt2img@0.3.1/+esm";

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

```
const value = Math.max(
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
```

}

function setBadge(type, text) {

```
statusBadge.className =
    `badge ${type}`;

statusBadge.textContent =
    text;
```

}

function setModelStatus(text) {

```
modelStatus.textContent =
    text;
```

}

// ============================================================
// WebGPU
// ============================================================

async function checkWebGPU() {

```
if (!("gpu" in navigator)) {

    webgpuStatus.textContent =
        "利用不可";

    throw new Error(
        "このブラウザではWebGPUが利用できません。"
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
```

}

// ============================================================
// AI初期化
// ============================================================

async function initializeAI() {

```
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
        1,
        "WebGPUを確認しています..."
    );


    await checkWebGPU();


    setModelStatus(
        "AIエンジンを起動中..."
    );

    setProgress(
        3,
        "AIエンジンを起動しています..."
    );


    /*
     * web-txt2img のWorkerクライアント
     */

    client =
        Txt2ImgWorkerClient.createDefault();


    setModelStatus(
        "対応状況を確認中..."
    );

    setProgress(
        5,
        "AIモデルの対応状況を確認しています..."
    );


    const caps =
        await client.detect();

    console.log(
        "Capabilities:",
        caps
    );


    if (!caps || !caps.webgpu) {

        throw new Error(
            "web-txt2imgからWebGPUを利用できませんでした。"
        );
    }


    setModelStatus(
        "SD-Turboを読み込んでいます..."
    );

    setProgress(
        6,
        "SD-Turboのダウンロードを開始しています..."
    );


    /*
     * モデルロード
     *
     * 初回は約2.3GBのモデルを
     * ブラウザへダウンロードします。
     */

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
                        `SD-Turbo読み込み中... ${Math.round(progress.pct)}%`
                    );

                    return;
                }


                /*
                 * pctが取得できない場合でも
                 * 「0%で固まった」ように見せない
                 */

                if (
                    progress &&
                    progress.bytesDownloaded &&
                    progress.totalBytesExpected
                ) {

                    const pct =
                        (
                            progress.bytesDownloaded /
                            progress.totalBytesExpected
                        ) * 100;

                    setProgress(
                        pct,
                        `モデルをダウンロード中... ${Math.round(pct)}%`
                    );

                    return;
                }


                setProgress(
                    6,
                    progress?.message ||
                    "SD-Turboを読み込んでいます..."
                );
            }
        );


    console.log(
        "LOAD RESULT:",
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
        "SD-Turbo READY"
    );


} catch (error) {

    console.error(
        "AI initialization error:",
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
        `エラー: ${error?.message || error}`
    );

}
```

}

// ============================================================
// 画像生成
// ============================================================

async function generateImage() {

```
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
            parsed;
    }


    console.log(
        "PROMPT:",
        prompt
    );


    console.log(
        "NEGATIVE PROMPT:",
        negativePromptInput.value.trim()
    );


    console.log(
        "SEED:",
        seed
    );


    /*
     * SD-Turbo
     *
     * SD-Turboは基本的に1ステップ生成モデル。
     * steps欄はUI互換のため残しています。
     */

    const request =
        client.generate(
            {
                prompt:
                    prompt,

                seed:
                    seed,

                width:
                    512,

                height:
                    512
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
                        10,
                        progress?.phase
                            ? `生成中: ${progress.phase}`
                            : "画像を生成しています..."
                    );
                }
            },

            {
                busyPolicy:
                    "queue",

                debounceMs:
                    200
            }
        );


    currentAbort =
        request.abort;


    const result =
        await request.promise;


    console.log(
        "GENERATION RESULT:",
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


    if (!result.blob) {

        throw new Error(
            "生成された画像データがありません。"
        );
    }


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
        "生成完了！"
    );


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
        `生成エラー: ${error?.message || error}`
    );


} finally {

    generating =
        false;

    currentAbort =
        null;

    generateButton.disabled =
        !modelLoaded;

    cancelButton.disabled =
        true;
}
```

}

// ============================================================
// キャンセル
// ============================================================

async function cancelGeneration() {

```
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


currentAbort =
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
```

}

// ============================================================
// ダウンロード
// ============================================================

async function downloadImage() {

```
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
```

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

```
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


            history.splice(
                6
            );


            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(history)
            );


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
```

}

function getHistory() {

```
try {

    return JSON.parse(
        localStorage.getItem(
            HISTORY_KEY
        ) || "[]"
    );

} catch {

    return [];
}
```

}

function renderHistory() {

```
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
```

}

clearHistoryButton.addEventListener(
"click",
() => {

```
    localStorage.removeItem(
        HISTORY_KEY
    );

    renderHistory();
}
```

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

```
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
```

// ============================================================
// テーマ
// ============================================================

themeButton.addEventListener(
"click",
() => {

```
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
```

);

if (
localStorage.getItem(
"theme"
) === "dark"
) {

```
document.body.classList.add(
    "dark"
);

themeButton.textContent =
    "☀️";
```

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
