import { db } from "../firebase-config.js";

import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    increment,
    query,
    where,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

//--------------------------------------------------
// Shared state giữa TẤT CẢ các selector trên cùng 1 trang
// (form Thêm sản phẩm + form Sửa sản phẩm dùng chung 1
// danh sách thể loại, để add/sửa/xoá ở đâu cũng đồng bộ)
//--------------------------------------------------

let sharedGenres = null;      // [{ id, name, usageCount }]
let sharedLoadPromise = null;
const genreListeners = new Set();

async function ensureGenresLoaded() {

    if (sharedGenres) return sharedGenres;

    if (!sharedLoadPromise) {

        sharedLoadPromise = (async () => {

            const list = [];

            const snapshot =
                await getDocs(
                    collection(db, "genres")
                );

            snapshot.forEach(docSnap => {

                const data = docSnap.data();

                if (
                    data.name &&
                    !list.some(g => g.name === data.name)
                ) {

                    list.push({
                        id: docSnap.id,
                        name: data.name,
                        usageCount: data.usageCount || 0
                    });

                }

            });

            sharedGenres = list;

        })();

    }

    await sharedLoadPromise;

    return sharedGenres;

}

function notifyGenresChanged(event) {

    genreListeners.forEach(fn => {

        try {

            fn(event);

        } catch (err) {

            console.error("Genre listener error:", err);

        }

    });

}

export async function initGenreSelector({
    inputId,
    selectedId,
    dropdownId,
    addBtnId = null,   // optional: id của nút "+ Add Genre" cạnh ô search
    popularCount = 5    // số lượng thể loại hiển thị trong mục "Popular"
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

    const addBtn =
        addBtnId ? document.getElementById(addBtnId) : null;

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

    // genres: mảng DÙNG CHUNG với mọi selector khác trên trang
    // (không copy riêng, để add/sửa/xoá đồng bộ ngay lập tức)
    const genres = await ensureGenresLoaded();

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
    // Helpers: sort / popular
    //--------------------------------------------------

    function sortByName(list) {

        return [...list].sort(
            (a, b) => a.name.localeCompare(b.name)
        );

    }

    function getPopular(matching) {

        return [...matching]
            .filter(g => g.usageCount > 0)
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, popularCount);

    }

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
    // Firestore mutations
    //--------------------------------------------------

    async function createGenre(value) {

        const exists =
            genres.find(
                g =>
                    g.name.toLowerCase() ===
                    value.toLowerCase()
            );

        if (exists) {

            if (!selectedGenres.includes(exists.name)) {

                selectedGenres.push(exists.name);

                renderSelected();

            }

            input.value = "";

            hideDropdown();

            return;

        }

        const docRef =
            await addDoc(
                collection(db, "genres"),
                {
                    name: value,
                    usageCount: 0
                }
            );

        genres.push({
            id: docRef.id,
            name: value,
            usageCount: 0
        });

        selectedGenres.push(value);

        renderSelected();

        input.value = "";

        hideDropdown();

        notifyGenresChanged({ type: "create" });

    }

    async function renameGenreInProducts(oldName, newName) {

        const q =
            query(
                collection(db, "products"),
                where("genres", "array-contains", oldName)
            );

        const snapshot = await getDocs(q);

        for (const productDoc of snapshot.docs) {

            const data = productDoc.data();

            const updatedGenres =
                Array.from(
                    new Set(
                        (data.genres || []).map(
                            g => (g === oldName ? newName : g)
                        )
                    )
                );

            await updateDoc(
                doc(db, "products", productDoc.id),
                { genres: updatedGenres }
            );

        }

    }

    async function removeGenreFromProducts(name) {

        const q =
            query(
                collection(db, "products"),
                where("genres", "array-contains", name)
            );

        const snapshot = await getDocs(q);

        for (const productDoc of snapshot.docs) {

            await updateDoc(
                doc(db, "products", productDoc.id),
                { genres: arrayRemove(name) }
            );

        }

    }

    async function editGenre(genreObj) {

        const newName =
            prompt("Sửa tên thể loại:", genreObj.name);

        if (newName === null)
            return;

        const trimmed = newName.trim();

        if (!trimmed || trimmed === genreObj.name)
            return;

        const duplicate =
            genres.find(
                g =>
                    g.id !== genreObj.id &&
                    g.name.toLowerCase() === trimmed.toLowerCase()
            );

        if (duplicate) {

            alert("Thể loại này đã tồn tại!");

            return;

        }

        const oldName = genreObj.name;

        await updateDoc(
            doc(db, "genres", genreObj.id),
            { name: trimmed }
        );

        await renameGenreInProducts(oldName, trimmed);

        genreObj.name = trimmed;

        selectedGenres =
            selectedGenres.map(
                n => (n === oldName ? trimmed : n)
            );

        renderSelected();

        renderDropdown(input.value);

        notifyGenresChanged({ type: "rename", oldName, newName: trimmed });

    }

    async function removeGenre(genreObj) {

        if (
            !confirm(
                `Xoá thể loại "${genreObj.name}"? Thể loại này sẽ được gỡ khỏi các sản phẩm đang dùng.`
            )
        )
            return;

        await deleteDoc(
            doc(db, "genres", genreObj.id)
        );

        await removeGenreFromProducts(genreObj.name);

        const idx = genres.findIndex(g => g.id === genreObj.id);

        if (idx !== -1) genres.splice(idx, 1);

        selectedGenres =
            selectedGenres.filter(n => n !== genreObj.name);

        renderSelected();

        renderDropdown(input.value);

        notifyGenresChanged({ type: "delete", name: genreObj.name });

    }

    //--------------------------------------------------
    // Render dropdown
    //--------------------------------------------------

    function appendSectionHeader(label) {

        const header =
            document.createElement("div");

        header.className =
            "px-3 pt-2 pb-1 text-xs font-semibold uppercase text-gray-400";

        header.textContent = label;

        dropdown.appendChild(header);

    }

    function appendGenreRow(genreObj) {

        const row =
            document.createElement("div");

        row.className =
            "flex items-center justify-between px-3 py-2 hover:bg-gray-100 transition";

        const name =
            document.createElement("span");

        name.className = "cursor-pointer text-white-700 flex-1 truncate";

        name.textContent = genreObj.name;

        name.onclick = () => {

            if (!selectedGenres.includes(genreObj.name)) {

                selectedGenres.push(genreObj.name);

                renderSelected();

            }

            input.value = "";

            hideDropdown();

        };

        const actions =
            document.createElement("div");

        actions.className = "flex items-center gap-2 ml-2 shrink-0";

        const addButton =
            document.createElement("button");

        addButton.type = "button";

        addButton.className =
            "text-green-600 hover:text-green-800";

        addButton.textContent = "+";

        addButton.title = "Thêm vào lựa chọn";

        addButton.onclick = (e) => {

            e.stopPropagation();

            name.onclick();

        };

        const editButton =
            document.createElement("button");

        editButton.type = "button";

        editButton.className =
            "text-blue-500 hover:text-blue-700";

        editButton.textContent = "Add";

        editButton.title = "Sửa";

        editButton.onclick = (e) => {

            e.stopPropagation();

            editGenre(genreObj);

        };

        const deleteButton =
            document.createElement("button");

        deleteButton.type = "button";

        deleteButton.className =
            "text-red-500 hover:text-red-700";

        deleteButton.textContent = "Delete";

        deleteButton.title = "Xoá";

        deleteButton.onclick = (e) => {

            e.stopPropagation();

            removeGenre(genreObj);

        };

        actions.appendChild(addButton);

        actions.appendChild(editButton);

        actions.appendChild(deleteButton);

        row.appendChild(name);

        row.appendChild(actions);

        dropdown.appendChild(row);

    }

    function appendCreateRow(value) {

        const create =
            document.createElement("div");

        create.className =
            "px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 cursor-pointer font-medium";

        create.innerHTML =
            `➕ Create "<b>${value}</b>"`;

        create.onclick = () => createGenre(value);

        dropdown.appendChild(create);

    }

    function renderDropdown(keyword = "") {

        dropdown.innerHTML = "";

        const kw = keyword.trim().toLowerCase();

        const matching =
            genres.filter(
                g => g.name.toLowerCase().includes(kw)
            );

        if (!matching.length && !kw) {

            hideDropdown();

            return;

        }

        showDropdown();

        const popular = getPopular(matching);

        const popularIds = new Set(popular.map(g => g.id));

        const others =
            sortByName(
                matching.filter(g => !popularIds.has(g.id))
            );

        if (popular.length) {

            appendSectionHeader("Popular");

            popular.forEach(appendGenreRow);

        }

        if (others.length) {

            appendSectionHeader("All Genres");

            others.forEach(appendGenreRow);

        }

        if (kw) {

            const existed =
                genres.find(
                    g => g.name.toLowerCase() === kw
                );

            if (!existed) {

                appendCreateRow(keyword.trim());

            }

        }

    }

    // Events

    input.addEventListener(
        "input",
        () => renderDropdown(input.value)
    );

    input.addEventListener(
        "focus",
        () => renderDropdown(input.value)
    );

    input.addEventListener(
        "keydown",
        e => {

            // Không cho Enter submit form

            if (e.key === "Enter") {

                e.preventDefault();

            }

            // Backspace xoá chip cuối

            if (
                e.key === "Backspace" &&
                input.value === "" &&
                selectedGenres.length
            ) {

                selectedGenres.pop();

                renderSelected();

                renderDropdown("");

            }

        }
    );

    if (addBtn) {

        addBtn.addEventListener("click", () => {

            const value = input.value.trim();

            if (value) {

                createGenre(value);

            } else {

                input.focus();

                renderDropdown("");

            }

        });

    }

    // Đồng bộ với các selector khác trên trang
    function handleGenresChanged(event) {

        if (event?.type === "rename") {

            selectedGenres =
                selectedGenres.map(
                    n => (n === event.oldName ? event.newName : n)
                );

        } else if (event?.type === "delete") {

            selectedGenres =
                selectedGenres.filter(n => n !== event.name);

        }

        renderSelected();

        if (!dropdown.classList.contains("hidden")) {

            renderDropdown(input.value);

        }

    }

    genreListeners.add(handleGenresChanged);

    // Click outside

    document.addEventListener(
        "click",
        e => {

            if (
                !dropdown.contains(e.target) &&
                !input.contains(e.target) &&
                (!addBtn || !addBtn.contains(e.target))
            ) {

                hideDropdown();

            }

        }
    );

    // API

    renderSelected();

    return {

        // Get selected genres

        getSelected() {

            return [...selectedGenres];

        },

        // Set selected genres

        setSelected(arr = []) {

            selectedGenres = [...arr];

            renderSelected();

        },

        // Clear

        clear() {

            selectedGenres = [];

            renderSelected();

            input.value = "";

            hideDropdown();

        },

        //--------------------------------------
        // Cập nhật usageCount cho "Popular"
        // Gọi sau khi thêm/sửa/xoá sản phẩm thành công
        // oldGenres: mảng tên thể loại trước khi lưu
        // newGenres: mảng tên thể loại sau khi lưu
        //--------------------------------------

        async recordUsage(oldGenres = [], newGenres = []) {

            const added =
                newGenres.filter(n => !oldGenres.includes(n));

            const removed =
                oldGenres.filter(n => !newGenres.includes(n));

            for (const name of added) {

                const g = genres.find(x => x.name === name);

                if (!g) continue;

                try {

                    await updateDoc(
                        doc(db, "genres", g.id),
                        { usageCount: increment(1) }
                    );

                    g.usageCount += 1;

                } catch (err) {

                    // Thể loại có thể đã bị xoá ở nơi khác — bỏ qua,
                    // không để lỗi này làm hỏng việc lưu sản phẩm.
                    console.warn(
                        `Không thể cập nhật usageCount cho "${name}":`,
                        err
                    );

                }

            }

            for (const name of removed) {

                const g = genres.find(x => x.name === name);

                if (!g) continue;

                try {

                    await updateDoc(
                        doc(db, "genres", g.id),
                        { usageCount: increment(-1) }
                    );

                    g.usageCount = Math.max(0, g.usageCount - 1);

                } catch (err) {

                    console.warn(
                        `Không thể cập nhật usageCount cho "${name}":`,
                        err
                    );

                }

            }

        }

    };

}