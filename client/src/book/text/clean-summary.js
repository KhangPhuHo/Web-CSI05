const fs = require("fs");

const INPUT = "books.json";
const OUTPUT = "books-fixed.json";

let text = fs.readFileSync(INPUT, "utf8");

const report = {
    summaries: 0,
    quotes: 0,
    spaces: 0,
    periods: 0,
    duplicates: 0
};

// ==============================
// CLEAN SUMMARY
// ==============================

function cleanSummary(summary) {

    let old;

    do {
        old = summary;

        summary = summary

            .normalize("NFC")

            // ký tự điều khiển
            .replace(/[\u0000-\u001F\u007F]/g, " ")

            // xuống dòng
            .replace(/[\r\n\t]+/g, " ")

            // nhiều khoảng trắng
            .replace(/\s+/g, " ")

            // khoảng trắng trước dấu câu
            .replace(/\s+([,.!?;:])/g, "$1")

            // dấu phẩy
            .replace(/,([A-Za-zÀ-ỹ])/g, ", $1")

            // dấu :
            .replace(/:([A-Za-zÀ-ỹ])/g, ": $1")

            // thiếu space sau .
            .replace(/\.([A-ZÀ-ỸĂÂĐÊÔƠƯ])/g, ". $1")

            .replace(/\?([A-ZÀ-ỸĂÂĐÊÔƠƯ])/g, "? $1")

            .replace(/!([A-ZÀ-ỸĂÂĐÊÔƠƯ])/g, "! $1")

            // lỗi AI thường gặp
            .replace(/ngôn ngữ\.Nó/g, () => {
                report.periods++;
                return "ngôn ngữ. Nó";
            })

            .replace(/sự nghiệp\.Tư duy/g, () => {
                report.periods++;
                return "sự nghiệp. Tư duy";
            })

            .replace(/quay trở lại Ông/g, () => {
                report.periods++;
                return "quay trở lại. Ông";
            })

            .replace(/hoàn thành sách\.Hãy/g, () => {
                report.periods++;
                return "hoàn thành sách. Hãy";
            })

            // từ lặp
            .replace(/\b([\p{L}\p{N}]+)\s+\1\b/giu, (_, word) => {
                report.duplicates++;
                return word;
            })

            .trim();

    } while (summary !== old);

    return summary;
}

// ==============================
// REPAIR
// ==============================

let out = "";

let i = 0;

while (i < text.length) {

    // tìm "summary"
    if (text.startsWith('"summary"', i)) {

        const startKey = i;

        const colon = text.indexOf(":", startKey);

        const firstQuote = text.indexOf('"', colon);

        out += text.substring(i, firstQuote + 1);

        i = firstQuote + 1;

        let summary = "";

        while (i < text.length) {

            const ch = text[i];

            // nếu gặp dấu " thì xem phía sau là gì
            if (ch === '"') {

                let j = i + 1;

                while (/\s/.test(text[j])) j++;

                // kết thúc summary
                if (
                    text[j] === "," ||
                    text[j] === "}" ||
                    text[j] === "]"
                ) {
                    break;
                }

                // quote bên trong
                report.quotes++;

                summary += '\\"';

                i++;

                continue;
            }

            summary += ch;

            i++;
        }

        report.summaries++;

        summary = cleanSummary(summary);

        out += summary;

        out += '"';

        i++; // bỏ qua dấu " kết thúc

    } else {

        out += text[i];

        i++;

    }

}

// ghi file

fs.writeFileSync(OUTPUT, out, "utf8");

console.log("");
console.log("==========================");
console.log("BOOK REPAIR REPORT");
console.log("==========================");
console.log("Summary :", report.summaries);
console.log("Quotes  :", report.quotes);
console.log("Periods :", report.periods);
console.log("DupWords:", report.duplicates);
console.log("");
console.log("Saved ->", OUTPUT);

// kiểm tra JSON

try {

    JSON.parse(fs.readFileSync(OUTPUT, "utf8"));

    console.log("");
    console.log("✅ JSON VALID");

} catch (e) {

    console.log("");
    console.log("❌ JSON INVALID");
    console.log(e.message);

}