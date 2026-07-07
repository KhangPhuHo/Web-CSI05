import { db } from "../firebase-config.js";

import {
    collection,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export async function createSelector({

    collectionName,

    inputId,

    selectedId,

    dropdownId,

    createLabel = "Create"

}) {

    const input =
        document.getElementById(inputId);

    const selectedBox =
        document.getElementById(selectedId);

    const dropdown =
        document.getElementById(dropdownId);

    if (
        !input ||
        !selectedBox ||
        !dropdown
    ) {

        console.error(
            "Selector not found",
            {
                inputId,
                selectedId,
                dropdownId
            }
        );

        return null;
    }

    //------------------------------------------------

    let allItems = [];

    let selectedItems = [];

    function hideDropdown() {

        dropdown.innerHTML = "";
        dropdown.classList.add("hidden");

    }

    function showDropdown() {

        dropdown.classList.remove("hidden");

    }

    //------------------------------------------------
    // Load Firestore
    //------------------------------------------------

    async function loadItems() {

        allItems = [];

        const snapshot =
            await getDocs(
                collection(
                    db,
                    collectionName
                )
            );

        snapshot.forEach(doc => {

            const value =
                doc.data().name;

            if (value)
                allItems.push(value);

        });

        allItems.sort((a, b) =>
            a.localeCompare(b)
        );

    }

    await loadItems();

    //------------------------------------------------
    // Render chips
    //------------------------------------------------

    function renderSelected() {

        selectedBox.innerHTML = "";

        selectedItems.forEach(name => {

            const chip =
                document.createElement("div");

            chip.className =
                "inline-flex items-center bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-sm mr-2 mb-2";

            chip.innerHTML = `

                <span>${name}</span>

                <button
                    type="button"
                    class="ml-2 text-red-500 font-bold">

                    ✕

                </button>

            `;

            chip
                .querySelector("button")
                .onclick = () => {

                    selectedItems =
                        selectedItems.filter(
                            x => x !== name
                        );

                    renderSelected();

                };

            selectedBox.appendChild(chip);

        });

    }

    //------------------------------------------------
    // Add
    //------------------------------------------------

    async function addItem(name) {

        name = name.trim();

        if (!name)
            return;

        const existed =
            allItems.find(
                x =>
                    x.toLowerCase() ===
                    name.toLowerCase()
            );

        if (selectedItems.includes(existed || name)) {

            input.value = "";

            hideDropdown();

            return;

        }

        let finalName;

        if (existed) {

            finalName = existed;

        } else {

            await addDoc(
                collection(
                    db,
                    collectionName
                ),
                {
                    name
                }
            );

            finalName = name;

            allItems.push(name);

            allItems.sort((a, b) =>
                a.localeCompare(b)
            );

        }

        selectedItems.push(finalName);

        renderSelected();

        input.value = "";

        hideDropdown();

    }

    //------------------------------------------------
    // Dropdown
    //------------------------------------------------

    function showDropdown(keyword = "") {

        hideDropdown();

        keyword =
            keyword.trim();

        const lower =
            keyword.toLowerCase();

        const filtered =
            allItems.filter(item =>

                item
                    .toLowerCase()
                    .includes(lower)

                &&

                !selectedItems.includes(item)

            );

        filtered.forEach(item => {

            const div =
                document.createElement("div");

            div.className =
                "px-3 py-2 hover:bg-gray-100 cursor-pointer";

            div.textContent = item;

            div.onclick =
                () => addItem(item);

            dropdown.appendChild(div);

        });

        if (

            keyword

            &&

            !allItems.some(
                x =>
                    x.toLowerCase()
                    === lower
            )

        ) {

            const div =
                document.createElement("div");

            div.className =
                "px-3 py-2 bg-green-50 text-green-700 cursor-pointer";

            div.innerHTML =
                `➕ ${createLabel} "<b>${keyword}</b>"`;

            div.onclick =
                () => addItem(keyword);

            dropdown.appendChild(div);

        }

    }

    //------------------------------------------------
    // Events
    //------------------------------------------------

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

                e.key === "Enter"

                ||

                e.key === ","

            ) {

                e.preventDefault();

                await addItem(
                    input.value
                );

            }

            if (

                e.key === "Backspace"

                &&

                input.value === ""

                &&

                selectedItems.length

            ) {

                selectedItems.pop();

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
                )

                &&

                e.target !== input

            ) {

                hideDropdown();

            }

        }
    );

    //------------------------------------------------

    renderSelected();

    //------------------------------------------------

    return {

        getSelected() {

            return [...selectedItems];

        },

        setSelected(arr) {

            selectedItems =
                Array.isArray(arr)
                    ? [...arr]
                    : [];

            renderSelected();

        },

        clear() {

            selectedItems = [];

            input.value = "";

            hideDropdown();

            renderSelected();

        },

        reload: loadItems

    };

}