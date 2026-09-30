"use strict";


const canvas =
    document.getElementById("canvas");

const promptInput =
    document.getElementById("prompt");

const sizeInput =
    document.getElementById("size");

const seedInput =
    document.getElementById("seed");

const qualityInput =
    document.getElementById("quality");

const generateButton =
    document.getElementById("generateButton");

const regenerateButton =
    document.getElementById("regenerateButton");

const downloadButton =
    document.getElementById("downloadButton");

const randomSeedButton =
    document.getElementById("randomSeed");

const themeButton =
    document.getElementById("themeButton");

const status =
    document.getElementById("status");

const resultInfo =
    document.getElementById("resultInfo");

const emptyState =
    document.getElementById("emptyState");

const loading =
    document.getElementById("loading");

const historyElement =
    document.getElementById("history");

const clearHistoryButton =
    document.getElementById("clearHistory");


let lastOptions = null;


/*
 * -----------------------------
 * Theme
 * -----------------------------
 */

function loadTheme() {

    const theme =
        localStorage.getItem(
            "image-generator-theme"
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
            "image-generator-theme",
            document.body.classList.contains("dark")
                ? "dark"
                : "light"
        );
    }
);


/*
 * -----------------------------
 * Random seed
 * -----------------------------
 */

randomSeedButton.addEventListener(
    "click",
    () => {

        seedInput.value =
            Math.floor(
                Math.random() * 2147483647
            );
    }
);


/*
 * -----------------------------
 * Quick prompts
 * -----------------------------
 */

document
    .querySelectorAll(".quick-prompts button")
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
 * -----------------------------
 * Generate
 * -----------------------------
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

    const size =
        Number(sizeInput.value);

    const seed =
        Number(seedInput.value) || 0;

    const quality =
        qualityInput.value;


    lastOptions = {
        prompt,
        size,
        seed,
        quality
    };


    generateButton.disabled = true;
    regenerateButton.disabled = true;

    loading.classList.remove("hidden");

    emptyState.style.display = "none";

    status.textContent =
        "画像を生成しています…";


    /*
     * UIを一度更新してから
     * 重いCanvas処理を実行。
     */

    await new Promise(
        resolve => setTimeout(resolve, 30)
    );


    try {

        generateImage(
            canvas,
            lastOptions
        );

        canvas.style.display =
            "block";

        resultInfo.textContent =
            `${size} × ${size} / Seed ${seed}`;

        downloadButton.disabled =
            false;

        regenerateButton.disabled =
            false;

        status.textContent =
            "生成完了";

        saveHistory(
            canvas,
            lastOptions
        );

        renderHistory();

    } catch (error) {

        console.error(error);

        status.textContent =
            "画像生成中にエラーが発生しました。";

    } finally {

        loading.classList.add("hidden");

        generateButton.disabled =
            false;
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
 * Enterではなく
 * Ctrl + Enterで生成
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
 * -----------------------------
 * Download
 * -----------------------------
 */

downloadButton.addEventListener(
    "click",
    () => {

        if (!canvas.width) {
            return;
        }

        const link =
            document.createElement("a");

        const safeName =
            (lastOptions?.prompt || "image")
                .replace(
                    /[\\/:*?"<>|]/g,
                    "_"
                )
                .slice(0, 40);

        link.download =
            `${safeName}.png`;

        link.href =
            canvas.toDataURL(
                "image/png"
            );

        link.click();
    }
);


/*
 * -----------------------------
 * History
 * -----------------------------
 */

function saveHistory(canvas, options) {

    const image =
        canvas.toDataURL(
            "image/jpeg",
            0.78
        );

    const item = {
        image,
        prompt: options.prompt,
        seed: options.seed,
        size: options.size,
        quality: options.quality,
        date: Date.now()
    };

    let history =
        JSON.parse(
            localStorage.getItem(
                "image-generator-history"
            ) || "[]"
        );

    history.unshift(item);

    /*
     * LocalStorageを圧迫しないよう
     * 最大12件。
     */

    history =
        history.slice(0, 12);

    try {

        localStorage.setItem(
            "image-generator-history",
            JSON.stringify(history)
        );

    } catch (error) {

        /*
         * 容量不足なら古いものから削除。
         */

        history =
            history.slice(0, 5);

        try {

            localStorage.setItem(
                "image-generator-history",
                JSON.stringify(history)
            );

        } catch {
            console.warn(
                "履歴を保存できませんでした。"
            );
        }
    }
}


function getHistory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "image-generator-history"
            ) || "[]"
        );

    } catch {

        return [];
    }
}


function renderHistory() {

    const history =
        getHistory();

    historyElement.innerHTML = "";

    if (!history.length) {

        historyElement.innerHTML =
            `<div class="history-empty">
                生成履歴はありません
            </div>`;

        return;
    }


    history.forEach(
        (item, index) => {

            const element =
                document.createElement("div");

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

                    loadHistoryItem(
                        item
                    );
                }
            );


            historyElement.appendChild(
                element
            );
        }
    );
}


function loadHistoryItem(item) {

    promptInput.value =
        item.prompt;

    seedInput.value =
        item.seed;

    sizeInput.value =
        item.size;

    qualityInput.value =
        item.quality;

    /*
     * 履歴画像を直接表示
     */

    const image =
        new Image();

    image.onload = () => {

        canvas.width =
            image.width;

        canvas.height =
            image.height;

        const ctx =
            canvas.getContext("2d");

        ctx.drawImage(
            image,
            0,
            0
        );

        canvas.style.display =
            "block";

        emptyState.style.display =
            "none";

        downloadButton.disabled =
            false;

        regenerateButton.disabled =
            false;

        lastOptions = {
            prompt: item.prompt,
            seed: item.seed,
            size: item.size,
            quality: item.quality
        };

        resultInfo.textContent =
            `${item.size} × ${item.size} / Seed ${item.seed}`;

        status.textContent =
            "履歴から読み込みました";
    };

    image.src =
        item.image;
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
            "image-generator-history"
        );

        renderHistory();

        status.textContent =
            "履歴を削除しました";
    }
);


/*
 * -----------------------------
 * XSS対策
 * -----------------------------
 */

function escapeHTML(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/*
 * -----------------------------
 * Start
 * -----------------------------
 */

loadTheme();
renderHistory();
