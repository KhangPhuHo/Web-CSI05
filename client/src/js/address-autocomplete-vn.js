export async function setupVNAddressAutocomplete(inputId, suggestionListId) {
  const input = document.getElementById(inputId);
  const suggestionList = document.getElementById(suggestionListId);
  let allSuggestions = [];

  try {
    const res = await fetch("https://provinces.open-api.vn/api/?depth=3");
    const data = await res.json();

    const shorten = (prefix, name) =>
      name.startsWith(prefix) ? name.replace(prefix, prefix[0] + ".") : name;

    data.forEach(province => {
      const provinceName = province.name.replace("Thành phố ", "").replace("Tỉnh ", "");

      province.districts.forEach(district => {
        const districtName = shorten("Quận ", shorten("Huyện ", district.name));

        district.wards.forEach(ward => {
          const wardName = shorten("Phường ", shorten("Xã ", ward.name));
          const formatted = `${wardName}, ${districtName}, ${provinceName}`;
          allSuggestions.push(formatted);
        });
      });
    });
  } catch (err) {
    console.error("Không thể tải địa chỉ:", err);
  }

  input.addEventListener("input", () => {
    const raw = input.value;
    const parts = raw.split(",");
    const keyword = parts[parts.length - 1].trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const matches = allSuggestions
      .filter(addr =>
        addr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(keyword)
      )
      .slice(0, 15);

    suggestionList.innerHTML = matches.map(match =>
      `<li class="px-4 py-2 hover:bg-indigo-100 cursor-pointer">${match}</li>`
    ).join("");

    suggestionList.classList.toggle("hidden", matches.length === 0);
  });

  suggestionList.addEventListener("click", (e) => {
  if (e.target.tagName === "LI") {
    const base = input.value.split(",")[0]?.trim(); // "12 Lê Sao"
    input.value = base + ", " + e.target.textContent; // => "12 Lê Sao, Hiệp Phú, Quận 9, TP.HCM"
    suggestionList.classList.add("hidden");
  }
});


document.addEventListener("click", (e) => {
  if (!suggestionList.contains(e.target) && e.target !== input) {
    suggestionList.classList.add("hidden");
  }
});
}