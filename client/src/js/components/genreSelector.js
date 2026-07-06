import { db } from "../firebase-config.js";

import {
    collection,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

let allGenres = [];
let selectedGenres = [];

let input;
let selectedContainer;
let dropdown;

// ===============================
// Khởi tạo
// ===============================
export async function initGenreSelector(options = {}) {

    input = document.getElementById(options.inputId);
    selectedContainer = document.getElementById(options.selectedId);
    dropdown = document.getElementById(options.dropdownId);

    selectedGenres = [...(options.defaultGenres || [])];

    await loadGenres();

    renderSelectedGenres();

    input.addEventListener("input", handleSearch);

    input.addEventListener("keydown", async (e) => {

        if (e.key !== "Enter") return;

        e.preventDefault();

        const value = input.value.trim();

        if (!value) return;

        const exist = allGenres.find(g =>
            g.toLowerCase() === value.toLowerCase()
        );

        if (exist) {

            addGenre(exist);

        } else {

            await createGenre(value);

            addGenre(value);

            allGenres.push(value);
        }

        input.value = "";

        renderDropdown([]);
    });
}

// ===============================
// Load genres
// ===============================

async function loadGenres() {

    allGenres = [];

    const snapshot = await getDocs(
        collection(db, "genres")
    );

    snapshot.forEach(doc => {

        const data = doc.data();

        if (data.name) {

            allGenres.push(data.name);
        }
    });

    allGenres.sort();
}

// ===============================
// Search
// ===============================

function handleSearch() {

    const keyword =
        input.value.trim();

    if (!keyword) {

        renderDropdown([], "");

        return;
    }

    const result = allGenres.filter(g =>
        g.toLowerCase()
            .includes(keyword.toLowerCase())
    );

    renderDropdown(result, keyword);
}

// ===============================
// Dropdown
// ===============================

function renderDropdown(list, keyword = "") {

    dropdown.innerHTML = "";

    const lower =
        keyword.toLowerCase();

    list.forEach(name => {

        const div =
            document.createElement("div");

        div.className =
            "px-3 py-2 hover:bg-gray-100 cursor-pointer";

        div.textContent = name;

        div.onclick = () => {

            addGenre(name);

            input.value = "";

            renderDropdown([], "");
        };

        dropdown.appendChild(div);
    });

    // Không tồn tại thì hiện Create

    if (
        keyword &&
        !allGenres.some(
            g => g.toLowerCase() === lower
        )
    ) {

        const create =
            document.createElement("div");

        create.className =
            "px-3 py-2 border-t bg-blue-50 hover:bg-blue-100 cursor-pointer text-blue-600 font-medium";

        create.textContent =
            `➕ Create "${keyword}"`;

        create.onclick = async () => {

            await createGenre(keyword);

            allGenres.push(keyword);

            allGenres.sort();

            addGenre(keyword);

            input.value = "";

            renderDropdown([], "");
        };

        dropdown.appendChild(create);
    }

    dropdown.style.display =
        dropdown.children.length
            ? "block"
            : "none";
}

// ===============================
// Selected Tags
// ===============================

function renderSelectedGenres() {

    selectedContainer.innerHTML = "";

    selectedGenres.forEach(name => {

        const tag = document.createElement("div");

        tag.className =
            "inline-flex items-center bg-blue-500 text-white rounded-full px-3 py-1 m-1";

        tag.innerHTML = `
            <span>${name}</span>
            <button
                class="ml-2"
                data-name="${name}"
            >
                ✕
            </button>
        `;

        tag.querySelector("button")
            .onclick = () => {

                selectedGenres =
                    selectedGenres.filter(
                        g => g !== name
                    );

                renderSelectedGenres();
            };

        selectedContainer.appendChild(tag);
    });
}

// ===============================
// Add genre
// ===============================

function addGenre(name) {

    if (selectedGenres.includes(name))
        return;

    selectedGenres.push(name);

    renderSelectedGenres();
}

// ===============================
// Firestore
// ===============================

async function createGenre(name) {

    await addDoc(
        collection(db, "genres"),
        {
            name
        }
    );
}

// ===============================
// Export
// ===============================

export function getSelectedGenres() {

    return [...selectedGenres];
}

export function setSelectedGenres(list = []) {

    selectedGenres = [...list];

    renderSelectedGenres();
}