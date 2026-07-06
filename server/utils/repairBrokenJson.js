const fs = require("fs");

async function repairJsonFile(filePath) {

    let text = fs.readFileSync(filePath, "utf8");

    const report = {
        summaries: 0,
        quotes: 0,
        periods: 0,
        duplicates: 0,
        alreadyFixed: 0
    };

    // ==============================
    // CLEAN SUMMARY
    // ==============================

    function cleanSummary(summary) {

        if (!summary) return "";

        summary = summary.normalize("NFC");

        let old;
        let loopCount = 0;

        do {

            old = summary;

            summary = summary

                .replace(/[\u0000-\u001F\u007F]/g, " ")
                .replace(/[\r\n\t]+/g, " ")
                .replace(/\s+/g, " ")
                .replace(/\s+([,.!?;:])/g, "$1")
                .replace(/,([A-Za-zÀ-ỹ])/g, ", $1")
                .replace(/:([A-Za-zÀ-ỹ])/g, ": $1")
                .replace(/\.([A-ZÀ-ỸĂÂĐÊÔƠƯ])/g, ". $1")
                .replace(/\?([A-ZÀ-ỸĂÂĐÊÔƠƯ])/g, "? $1")
                .replace(/!([A-ZÀ-ỸĂÂĐÊÔƠƯ])/g, "! $1")

                .replace(/(\b\p{L}+)\s+(\p{L}+)/giu,
                    (match, w1, w2) => {

                        if (
                            w1.toLowerCase() ===
                            w2.toLowerCase()
                        ) {

                            report.duplicates++;

                            return w1;
                        }

                        return match;
                    }
                )

                .trim();

            loopCount++;

        } while (
            summary !== old &&
            loopCount < 15
        );

        return summary;
    }

    // ==============================
    // MAIN REPAIR
    // ==============================

    let out = "";
    let i = 0;

    while (i < text.length) {

        if (text.startsWith('"summary"', i)) {

            let objectStart =
                text.lastIndexOf("{", i);

            let objectEnd = -1;

            if (objectStart !== -1) {

                let depth = 0;

                for (
                    let p = objectStart;
                    p < text.length;
                    p++
                ) {

                    if (text[p] === "{")
                        depth++;

                    if (text[p] === "}") {

                        depth--;

                        if (depth === 0) {

                            objectEnd = p;

                            break;
                        }
                    }
                }
            }

            let alreadyFixed = false;

            if (objectEnd !== -1) {

                const currentObject =
                    text.substring(
                        objectStart,
                        objectEnd + 1
                    );

                alreadyFixed =
                    /"isFixed"\s*:\s*true/
                        .test(currentObject);
            }

            if (alreadyFixed) {

                report.alreadyFixed++;

                out += '"summary"';

                i += 9;

                continue;
            }

            report.summaries++;

            const colon =
                text.indexOf(":", i);

            const firstQuote =
                text.indexOf('"', colon);

            out += text.substring(
                i,
                firstQuote + 1
            );

            i = firstQuote + 1;

            let summary = "";

            while (i < text.length) {

                const ch = text[i];

                if (ch === '"') {

                    let j = i + 1;

                    while (
                        j < text.length &&
                        /\s/.test(text[j])
                    ) {
                        j++;
                    }

                    if (
                        text[j] === "," ||
                        text[j] === "}" ||
                        text[j] === "]"
                    ) {
                        break;
                    }

                    report.quotes++;

                    summary += '\\"';

                    i++;

                    continue;
                }

                summary += ch;

                i++;
            }

            out +=
                cleanSummary(summary) + '"';

            i++;

            let cursor = i;

            while (cursor < text.length) {

                if (text[cursor] === "}") {

                    const between =
                        text.substring(
                            i,
                            cursor
                        );

                    out += between;

                    out +=
                        ',\n    "isFixed": true\n';

                    out += "}";

                    i = cursor + 1;

                    break;
                }

                cursor++;
            }

        } else {

            out += text[i];

            i++;
        }
    }

    fs.writeFileSync(
        filePath,
        out,
        "utf8"
    );

    console.log("");
    console.log("==========================");
    console.log("BOOK REPAIR REPORT");
    console.log("==========================");
    console.log("Đã sửa mới       :", report.summaries);
    console.log("Đã bỏ qua        :", report.alreadyFixed);
    console.log("Dấu nháy sửa     :", report.quotes);
    console.log("Từ lặp sửa       :", report.duplicates);
    console.log("");

    try {

        JSON.parse(
            fs.readFileSync(
                filePath,
                "utf8"
            )
        );

        console.log(
            "✅ JSON VALID"
        );

    } catch (e) {

        console.log(
            "❌ JSON INVALID"
        );

        console.log(e.message);

        throw e;
    }
}

module.exports = repairJsonFile;