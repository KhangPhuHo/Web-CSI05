// ======================================================
// Tag Manager Utilities
// Version: 1.0
// ======================================================

export function normalizeText(text = "") {
    return text
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

export function slugify(text = "") {
    return normalizeText(text)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function capitalize(text = "") {
    return text
        .split(" ")
        .map(word => {

            if (!word.length)
                return "";

            return word.charAt(0).toUpperCase()
                + word.slice(1);

        })
        .join(" ");
}

export function uniqueArray(arr = []) {

    return [...new Set(arr)];

}

export function debounce(fn, delay = 300) {

    let timer;

    return (...args) => {

        clearTimeout(timer);

        timer = setTimeout(() => {

            fn(...args);

        }, delay);

    };

}

export function createElement(tag, className = "", html = "") {

    const el = document.createElement(tag);

    if (className)
        el.className = className;

    if (html)
        el.innerHTML = html;

    return el;

}

export function empty(el) {

    while (el.firstChild) {

        el.removeChild(el.firstChild);

    }

}

export function fadeIn(el) {

    el.classList.remove("hidden");

    requestAnimationFrame(() => {

        el.classList.remove("opacity-0");
        el.classList.remove("scale-95");

    });

}

export function fadeOut(el, callback) {

    el.classList.add("opacity-0");
    el.classList.add("scale-95");

    setTimeout(() => {

        el.classList.add("hidden");

        callback?.();

    }, 200);

}

export function escapeHTML(text = "") {

    const div = document.createElement("div");

    div.innerText = text;

    return div.innerHTML;

}

export function containsIgnoreCase(a, b) {

    return normalizeText(a).includes(
        normalizeText(b)
    );

}

export function startsWithIgnoreCase(a, b) {

    return normalizeText(a).startsWith(
        normalizeText(b)
    );

}

export function randomId(prefix = "tag") {

    return prefix + "_"
        + Math.random()
            .toString(36)
            .substring(2, 10);

}

export function sortAZ(list = []) {

    return [...list].sort((a, b) =>
        a.name.localeCompare(b.name)
    );

}

export function isSameName(a, b) {

    return normalizeText(a) ===
        normalizeText(b);

}

export function moveArrayItem(arr, from, to) {

    const clone = [...arr];

    const item = clone.splice(from, 1)[0];

    clone.splice(to, 0, item);

    return clone;

}

export function sleep(ms = 300) {

    return new Promise(resolve => {

        setTimeout(resolve, ms);

    });

}

export function createIconButton(icon, color = "gray") {

    const btn = document.createElement("button");

    btn.type = "button";

    btn.className =
        `
        w-8
        h-8
        rounded-lg
        flex
        items-center
        justify-center
        hover:bg-${color}-700
        transition
        `;

    btn.innerHTML = icon;

    return btn;

}