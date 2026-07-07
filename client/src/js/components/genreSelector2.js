import { db } from "../firebase-config.js";

import {
    collection,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export async function initGenreSelector({
    inputId,
    selectedId,
    dropdownId
}) {

    //--------------------------------------------------
    // Elements
    //--------------------------------------------------

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
            "Genre selector:",
            inputId,
            selectedId,
            dropdownId,
            "not found."
        );

        return null;

    }

    //--------------------------------------------------
    // State
    //--------------------------------------------------

    let genres = [];

    let selectedGenres = [];

    //--------------------------------------------------
    // Dropdown helper
    //--------------------------------------------------

    function hideDropdown() {

        dropdown.innerHTML = "";

        dropdown.classList.add("hidden");

    }

    function showDropdown() {

        dropdown.classList.remove("hidden");

    }

    //--------------------------------------------------
    // Load Firestore
    //--------------------------------------------------

    async function loadGenres() {

        genres = [];

        const snapshot =
            await getDocs(
                collection(db, "genres")
            );

        snapshot.forEach(doc => {

            const data = doc.data();

            if (
                data.name &&
                !genres.includes(data.name)
            ) {

                genres.push(data.name);

            }

        });

        genres.sort((a, b) =>
            a.localeCompare(b)
        );

    }

    await loadGenres();

    //--------------------------------------------------
    // Render selected chips
    //--------------------------------------------------

    function renderSelected() {

        selectedBox.innerHTML = "";

        selectedGenres.forEach(name => {

            const chip =
                document.createElement("div");

            chip.className =
                "inline-flex items-center bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-sm mr-2 mb-2";

            chip.innerHTML = `
                <span>${name}</span>

                <button
                    type="button"
                    class="ml-2 text-red-500 hover:text-red-700">
                    ✕
                </button>
            `;

            chip
                .querySelector("button")
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
    // Render dropdown
    //--------------------------------------------------

    function renderDropdown(list, keyword = "") {

        dropdown.innerHTML = "";

        if (!list.length && !keyword.trim()) {

            hideDropdown();

            return;

        }

        showDropdown();

        //------------------------------------------
        // Existing genres
        //------------------------------------------

        list.forEach(name => {

            const item =
                document.createElement("div");

            item.className =
                "px-3 py-2 hover:bg-gray-100 cursor-pointer transition";

            item.textContent = name;

            item.onclick = () => {

                if (
                    !selectedGenres.includes(name)
                ) {

                    selectedGenres.push(name);

                    renderSelected();

                }

                input.value = "";

                hideDropdown();

            };

            dropdown.appendChild(item);

        });

        //------------------------------------------
        // Create new genre
        //------------------------------------------

        const value =
            keyword.trim();

        if (!value)
            return;

        const existedGenre =
            genres.find(
                g =>
                    g.toLowerCase() ===
                    value.toLowerCase()
            );

        if (!existedGenre) {

            const create =
                document.createElement("div");

            create.className =
                "px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 cursor-pointer font-medium";

            create.innerHTML =
                `➕ Create "<b>${value}</b>"`;

            create.onclick =
                async () => {

                    //----------------------------------
                    // Save Firestore
                    //----------------------------------

                    await addDoc(
                        collection(db, "genres"),
                        {
                            name: value
                        }
                    );

                    //----------------------------------
                    // Update local
                    //----------------------------------

                    genres.push(value);

                    genres.sort(
                        (a, b) =>
                            a.localeCompare(b)
                    );

                    selectedGenres.push(value);

                    renderSelected();

                    input.value = "";

                    hideDropdown();

                };

            dropdown.appendChild(create);

        }

    }

    //--------------------------------------------------
    // Search
    //--------------------------------------------------

    function filterGenres(keyword = "") {

        keyword =
            keyword
                .trim()
                .toLowerCase();

        const filtered =
            genres.filter(name => {

                return (

                    !selectedGenres.includes(name)

                    &&

                    name
                        .toLowerCase()
                        .includes(keyword)

                );

            });

        renderDropdown(
            filtered,
            input.value
        );

    }
    //--------------------------------------------------
    // Events
    //--------------------------------------------------

    input.addEventListener(
        "input",
        () => {

            filterGenres(input.value);

        }
    );

    input.addEventListener(
        "focus",
        () => {

            filterGenres(input.value);

        }
    );

    input.addEventListener(
        "keydown",
        e => {

            //------------------------------------------
            // Không cho Enter submit form
            //------------------------------------------

            if (e.key === "Enter") {

                e.preventDefault();

            }

            //------------------------------------------
            // Backspace xoá chip cuối
            //------------------------------------------

            if (
                e.key === "Backspace" &&
                input.value === "" &&
                selectedGenres.length
            ) {

                selectedGenres.pop();

                renderSelected();

                filterGenres("");

            }

        }
    );

    //--------------------------------------------------
    // Click outside
    //--------------------------------------------------

    document.addEventListener(
        "click",
        e => {

            if (
                !dropdown.contains(e.target) &&
                !input.contains(e.target)
            ) {

                hideDropdown();

            }

        }
    );

    //--------------------------------------------------
    // API
    //--------------------------------------------------

    renderSelected();

    return {

        //--------------------------------------
        // Get selected genres
        //--------------------------------------

        getSelected() {

            return [...selectedGenres];

        },

        //--------------------------------------
        // Set selected genres
        //--------------------------------------

        setSelected(arr = []) {

            selectedGenres = [...arr];

            renderSelected();

        },

        //--------------------------------------
        // Clear
        //--------------------------------------

        clear() {

            selectedGenres = [];

            renderSelected();

            input.value = "";

            hideDropdown();

        }

    };

}