// ✅ ratings.js
import { db, auth } from './firebase-config.js';
import { getTranslation } from './language.js';
import {
  doc, getDoc, setDoc, collection,
  onSnapshot, query, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { showToast } from './toast.js';


export function loadRatingUI(productId) {
  const container = document.createElement("div");
  container.id = "rating-section";
  container.className = "text-center my-3";

  const starsDiv = document.createElement("div");
  starsDiv.className = "flex justify-center gap-1 text-yellow-400 text-2xl mb-1";

  const statusText = document.createElement("p");
  statusText.className = "text-sm text-gray-300";

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("i");
    star.className = "fa-regular fa-star cursor-pointer transition hover:scale-110";
    star.dataset.rating = i;
    star.onclick = () => submitRating(productId, i);
    starsDiv.appendChild(star);
  }

  container.appendChild(starsDiv);
  container.appendChild(statusText);

  const popup = document.querySelector(".face.front");
  popup.appendChild(container);

  // Listen to updates
  const ratingsRef = collection(db, `shapespeakitems/${productId}/ratings`);
  onSnapshot(ratingsRef, snap => {
  (async () => {
    const ratings = snap.docs.map(doc => doc.data());
    const total = ratings.length;
    const avg = total > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / total : 0;

    starsDiv.querySelectorAll("i").forEach((star, i) => {
      star.className = i < Math.round(avg)
        ? "fa-solid fa-star text-yellow-400"
        : "fa-regular fa-star text-yellow-400";
    });

    if (total > 0) {
      const voteText = await getTranslation(
        total === 1 ? "rating.vote_singular" : "rating.vote_plural"
      );
      statusText.innerHTML = `⭐ ${avg.toFixed(1)} / 5 (${total} ${voteText})`;
    } else {
      const noReviewText = await getTranslation("rating.no_review");
      statusText.innerHTML = noReviewText;
    }
  })();
});

  // Highlight user's rating
  onAuthStateChanged(auth, async user => {
    if (!user) return;

    const userRatingDoc = doc(db, `shapespeakitems/${productId}/ratings`, user.uid);
    const userSnap = await getDoc(userRatingDoc);
    if (userSnap.exists()) {
      const userRating = userSnap.data().rating;
      starsDiv.querySelectorAll("i").forEach((star, i) => {
        if (i < userRating) {
          star.classList.add("text-yellow-500", "fa-solid");
          star.classList.remove("fa-regular");
        }
      });
    }
  });
}

async function submitRating(productId, ratingValue) {
  const user = auth.currentUser;
  if (!user) {
    //showToast("Bạn cần đăng nhập để đánh giá!", "info");
    showToast(await getTranslation("rating.login_required"), "info");
    return;
  }

  const ratingRef = doc(db, `shapespeakitems/${productId}/ratings`, user.uid);
  await setDoc(ratingRef, {
    rating: ratingValue,
    uid: user.uid,
    timestamp: Date.now()
  });

  //showToast("🎉 Đánh giá của bạn đã được ghi nhận!", "success");
  showToast(await getTranslation("rating.thank_you"), "success");
}
