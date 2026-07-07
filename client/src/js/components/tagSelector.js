// src/js/components/tagSelector.js

import { db } from "../firebase-config.js";

import {
    collection,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export async function initTagSelector({
    inputId,
    selectedId,
    dropdownId
}) {

    const input = document.getElementById(inputId);
    const selectedBox = document.getElementById(selectedId);
    const dropdown = document.getElementById(dropdownId);

    let tags = [];
    let selectedTags = [];

    //--------------------------------------------------
    // Load Firestore
    //--------------------------------------------------

    async function loadTags() {

        tags = [];

        const snapshot = await getDocs(
            collection(db, "tags")
        );

        snapshot.forEach(doc => {

            tags.push(doc.data().name);

        });

        tags.sort();

    }

    await loadTags();

    //--------------------------------------------------
    // Render chips
    //--------------------------------------------------

    function renderSelected() {

        selectedBox.innerHTML = "";

        selectedTags.forEach(tag => {

            const chip = document.createElement("div");

            chip.className =
                "inline-flex items-center bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm mr-2 mb-2";

            chip.innerHTML = `
                ${tag}
                <button
                    class="ml-2 text-red-500"
                    type="button">
                    ✕
                </button>
            `;

            chip.querySelector("button").onclick = () => {

                selectedTags =
                    selectedTags.filter(
                        t => t !== tag
                    );

                renderSelected();

            };

            selectedBox.appendChild(chip);

        });

    }

    //--------------------------------------------------
    // Add tag
    //--------------------------------------------------

    async function addTag(name) {

        name = name.trim();

        if (!name) return;

        if (selectedTags.includes(name)) {

            input.value = "";

            dropdown.innerHTML = "";

            return;

        }

        const existed =
            tags.find(
                t =>
                    t.toLowerCase() ===
                    name.toLowerCase()
            );

        if (existed) {

            selectedTags.push(existed);

        } else {

            await addDoc(
                collection(db, "tags"),
                {
                    name
                }
            );

            tags.push(name);

            tags.sort();

            selectedTags.push(name);

        }

        renderSelected();

        input.value = "";

        dropdown.innerHTML = "";

    }

    //--------------------------------------------------
    // Dropdown
    //--------------------------------------------------

    function showDropdown(keyword = "") {

        dropdown.innerHTML = "";

        keyword =
            keyword.trim().toLowerCase();

        if (!keyword)
            return;

        const filtered = tags.filter(tag =>
            tag
                .toLowerCase()
                .includes(keyword)
            &&
            !selectedTags.includes(tag)
        );

        filtered.forEach(tag => {

            const item =
                document.createElement("div");

            item.className =
                "px-3 py-2 hover:bg-gray-100 cursor-pointer";

            item.textContent = tag;

            item.onclick =
                () => addTag(tag);

            dropdown.appendChild(item);

        });

        if (
            !tags.some(
                t =>
                    t.toLowerCase() === keyword
            )
        ) {

            const create =
                document.createElement("div");

            create.className =
                "px-3 py-2 bg-green-50 text-green-700 cursor-pointer";

            create.innerHTML =
                `➕ Create "<b>${input.value.trim()}</b>"`;

            create.onclick =
                () => addTag(
                    input.value
                );

            dropdown.appendChild(create);

        }

    }

    //--------------------------------------------------
    // Events
    //--------------------------------------------------

    input.addEventListener(
        "input",
        () => {

            showDropdown(
                input.value
            );

        }
    );

    input.addEventListener(
        "focus",
        () => {

            showDropdown(
                input.value
            );

        }
    );

    input.addEventListener(
        "keydown",
        async e => {

            if (
                e.key === "Enter" ||
                e.key === ","
            ) {

                e.preventDefault();

                await addTag(
                    input.value
                );

            }

            if (
                e.key === "Backspace" &&
                input.value === "" &&
                selectedTags.length
            ) {

                selectedTags.pop();

                renderSelected();

            }

        }
    );

    document.addEventListener(
        "click",
        e => {

            if (
                !dropdown.contains(
                    e.target
                ) &&
                e.target !== input
            ) {

                dropdown.innerHTML = "";

            }

        }
    );

    //--------------------------------------------------

    renderSelected();

    return {

        getSelected() {

            return [...selectedTags];

        },

        setSelected(arr) {

            selectedTags = [...arr];

            renderSelected();

        },

        clear() {

            selectedTags = [];

            renderSelected();

        }

    };

}