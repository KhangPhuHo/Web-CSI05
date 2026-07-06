const fs = require("fs");

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

            .replace(
                /(\b\p{L}+)\s+(\p{L}+)/giu,
                (match, w1, w2) => {

                    if (
                        w1.toLowerCase() ===
                        w2.toLowerCase()
                    ) {
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

async function repairProductsJson(filePath) {

    const json = JSON.parse(
        fs.readFileSync(filePath, "utf8")
    );

    let repaired = 0;
    let skipped = 0;

    for (const productId in json) {

        const product = json[productId];

        if (product.isFixed === true) {

            skipped++;
            continue;
        }

        product.summary = cleanSummary(
            product.summary || ""
        );

        product.isFixed = true;

        repaired++;
    }

    fs.writeFileSync(
        filePath,
        JSON.stringify(json, null, 2),
        "utf8"
    );

    console.log("");
    console.log("==========================");
    console.log("PRODUCT REPAIR REPORT");
    console.log("==========================");
    console.log("Đã sửa :", repaired);
    console.log("Bỏ qua :", skipped);
    console.log("Saved :", filePath);
    console.log("==========================");
}

module.exports = repairProductsJson;