/*
 * app.js — sample script for the assetopt demo pack.
 * Hand-authored, public domain (CC0).
 * Deliberately unminified (comments, long identifiers, whitespace) so that
 * `assetopt optimize` has real bytes to remove via JS minification.
 */

const DEFAULT_LOCALE = "en-US";

/**
 * Format a byte count into a human-readable string.
 * @param {number} byteCount
 * @returns {string}
 */
function formatByteSize(byteCount) {
    if (byteCount >= 1000 * 1000) {
        return (byteCount / (1024 * 1024)).toFixed(1) + " MB";
    }
    if (byteCount >= 1000) {
        return Math.round(byteCount / 1024) + " KB";
    }
    return byteCount + " B";
}

/**
 * Compute the savings percentage between an original and an optimized size.
 * @param {number} originalSize
 * @param {number} optimizedSize
 * @returns {number}
 */
function computeSavingsPercentage(originalSize, optimizedSize) {
    if (originalSize <= 0) {
        return 0;
    }
    const ratio = optimizedSize / originalSize;
    const saved = (1 - ratio) * 100;
    return Math.round(saved * 10) / 10;
}

/**
 * Render a list of asset results into a target element.
 * @param {HTMLElement} targetElement
 * @param {Array<{name: string, original: number, optimized: number}>} results
 */
function renderResults(targetElement, results) {
    const fragment = document.createDocumentFragment();

    results.forEach(function (result) {
        const row = document.createElement("div");
        row.className = "card";

        const title = document.createElement("h3");
        title.textContent = result.name;

        const savings = document.createElement("span");
        savings.className = "metric";
        savings.textContent =
            "-" + computeSavingsPercentage(result.original, result.optimized) + "%";

        const detail = document.createElement("p");
        detail.textContent =
            formatByteSize(result.original) +
            " to " +
            formatByteSize(result.optimized);

        row.appendChild(title);
        row.appendChild(savings);
        row.appendChild(detail);
        fragment.appendChild(row);
    });

    targetElement.replaceChildren(fragment);
}

document.addEventListener("DOMContentLoaded", function () {
    const mountPoint = document.getElementById("results");
    if (mountPoint) {
        renderResults(mountPoint, []);
    }
    console.log("Sample app initialized for locale " + DEFAULT_LOCALE + ".");
});
