import { db } from "./firebase-config.js";

import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ===============================
// DOM
// ===============================

const sectionEl = document.getElementById("latestNewsSection");

const titleEl = document.getElementById("latestNewsTitle");
const detailEl = document.getElementById("latestNewsContent");
const authorEl = document.getElementById("latestNewsAuthor");
const dateEl = document.getElementById("latestNewsDate");
const imageEl = document.getElementById("latestNewsImage");
const readMoreBtn = document.getElementById("latestNewsReadMore");

// ===============================
// Kiểm tra DOM
// ===============================

if (
    !sectionEl ||
    !titleEl ||
    !detailEl ||
    !authorEl ||
    !dateEl ||
    !imageEl ||
    !readMoreBtn
) {

    console.warn("Latest News section not found.");

}
else {

    // ===============================
    // Query bài mới nhất
    // ===============================

    const latestNewsQuery = query(
        collection(db, "news"),
        orderBy("createdAt", "desc"),
        limit(1)
    );

    // ===============================
    // Realtime
    // ===============================

    onSnapshot(
        latestNewsQuery,
        (snapshot) => {

            if (snapshot.empty) {

                titleEl.textContent = "No news available";
                detailEl.textContent = "";
                authorEl.textContent = "";
                dateEl.textContent = "";

                imageEl.src = "./src/img/no-image.png";

                delete sectionEl.dataset.newsId;

                return;
            }

            const docSnap = snapshot.docs[0];

            const news = {
                id: docSnap.id,
                ...docSnap.data()
            };

            // ===============================
            // Lưu ID
            // ===============================

            sectionEl.dataset.newsId = news.id;

            // ===============================
            // Title
            // ===============================

            titleEl.textContent = news.name || "Untitled";

            // ===============================
            // Details
            // ===============================

            const details = news.details || "";

            detailEl.textContent =
                details.length > 220
                    ? details.substring(0, 220) + "..."
                    : details;

            // ===============================
            // Author
            // ===============================

            authorEl.textContent =
                news.author || "Unknown";

            // ===============================
            // Date
            // ===============================

            if (news.createdAt) {

                const date = news.createdAt.toDate();

                const lang =
                    localStorage.getItem("language") || "en";

                dateEl.textContent =
                    date.toLocaleDateString(
                        lang === "vi" ? "vi-VN" : "en-GB",
                        {
                            day: "2-digit",
                            month: "long",
                            year: "numeric"
                        }
                    );
            }
            else {

                dateEl.textContent = "";

            }

            // ===============================
            // Image
            // ===============================

            imageEl.src =
                news.picture ||
                "./src/img/no-image.png";

            imageEl.alt =
                news.name || "Latest News";

            imageEl.onerror = () => {

                imageEl.src = "./src/img/no-image.png";

            };

        },
        (error) => {

            console.error(
                "Latest News Error:",
                error
            );

        }
    );

    // ===============================
    // Read More
    // ===============================

    readMoreBtn.addEventListener("click", () => {

        const newsId = sectionEl.dataset.newsId;

        if (!newsId) return;

        window.location.href = `news.html?id=${newsId}`;
        console.log(window.location.href);

    });

}