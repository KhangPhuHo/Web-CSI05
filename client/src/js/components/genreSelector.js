import { db } from "../firebase-config.js";

import {
    collection,
    getDocs,
    addDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export async function initGenreSelector({
    inputId,
    selectedId,
    dropdownId
}) {

    const input = document.getElementById(inputId);
    const selectedBox = document.getElementById(selectedId);
    const dropdown = document.getElementById(dropdownId);

    let genres = [];
    let selectedGenres = [];

    //--------------------------------------------------
    // Load Firestore
    //--------------------------------------------------

    async function loadGenres() {

        genres = [];

        const snapshot = await getDocs(
            collection(db, "genres")
        );

        snapshot.forEach(doc => {

            genres.push(doc.data().name);

        });

        genres.sort();
    }

    await loadGenres();

    //--------------------------------------------------
    // Render
    //--------------------------------------------------

    function renderSelected() {

        selectedBox.innerHTML = "";

        selectedGenres.forEach(name => {

            const chip = document.createElement("div");

            chip.className =
                "inline-flex items-center bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-sm mr-2 mb-2";

            chip.innerHTML = `
                ${name}
                <button
                    class="ml-2 text-red-500"
                    data-name="${name}">
                    ✕
                </button>
            `;

            chip.querySelector("button")
                .onclick = () => {

                    selectedGenres =
                        selectedGenres.filter(
                            g => g !== name
                        );

                    renderSelected();
                };

            selectedBox.appendChild(chip);

        });

    }

    //--------------------------------------------------
    // Dropdown
    //--------------------------------------------------

    function showDropdown(keyword = "") {

        dropdown.innerHTML = "";

        const value =
            keyword.trim().toLowerCase();

        const filtered = genres.filter(g =>
            g.toLowerCase().includes(value) &&
            !selectedGenres.includes(g)
        );

        filtered.forEach(name => {

            const item =
                document.createElement("div");

            item.className =
                "px-3 py-2 hover:bg-gray-100 cursor-pointer";

            item.textContent = name;

            item.onclick = () => {

                selectedGenres.push(name);

                renderSelected();

                input.value = "";

                dropdown.innerHTML = "";

            };

            dropdown.appendChild(item);

        });

        //-----------------------------------------
        // Create new
        //-----------------------------------------

        if (
            value &&
            !genres.some(
                g =>
                    g.toLowerCase() === value
            )
        ) {

            const create =
                document.createElement("div");

            create.className =
                "px-3 py-2 bg-green-50 text-green-700 cursor-pointer";

            create.innerHTML =
                `➕ Create "<b>${keyword}</b>"`;

            create.onclick = async () => {

                await addDoc(
                    collection(db, "genres"),
                    {
                        name: keyword
                    }
                );

                genres.push(keyword);

                genres.sort();

                selectedGenres.push(keyword);

                renderSelected();

                input.value = "";

                dropdown.innerHTML = "";

            };

            dropdown.appendChild(create);

        }

    }

    //--------------------------------------------------

    input.addEventListener("input", () => {

        showDropdown(input.value);

    });

    input.addEventListener("focus", () => {

        showDropdown(input.value);

    });

    document.addEventListener("click", e => {

        if (
            !dropdown.contains(e.target) &&
            e.target !== input
        ) {

            dropdown.innerHTML = "";

        }

    });

    //--------------------------------------------------

    renderSelected();

    return {

        getSelected() {

            return [...selectedGenres];

        },

        setSelected(arr) {

            selectedGenres = [...arr];

            renderSelected();

        },

        clear() {

            selectedGenres = [];

            renderSelected();

        }

    };

}