let selectedTags = [];

let input;
let container;

export function initTagSelector(inputId, containerId) {

    input = document.getElementById(inputId);
    container = document.getElementById(containerId);

    render();

    input.addEventListener("keydown", e => {

        if (e.key !== "Enter") return;

        e.preventDefault();

        const tag = input.value.trim();

        if (!tag) return;

        if (!selectedTags.includes(tag)) {

            selectedTags.push(tag);

            render();
        }

        input.value = "";
    });
}

function render() {

    container.innerHTML = "";

    selectedTags.forEach(tag => {

        const div = document.createElement("div");

        div.className =
            "inline-flex items-center bg-green-500 text-white rounded-full px-3 py-1 m-1";

        div.innerHTML = `
            <span>${tag}</span>
            <button class="ml-2">✕</button>
        `;

        div.querySelector("button").onclick = () => {

            selectedTags =
                selectedTags.filter(t => t !== tag);

            render();
        };

        container.appendChild(div);
    });
}

export function getSelectedTags() {

    return [...selectedTags];
}

export function setSelectedTags(tags = []) {

    selectedTags = [...tags];

    render();
}