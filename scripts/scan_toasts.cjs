const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith(".tsx")) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk("./src");

for (const f of files) {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    if (line.includes("setErrorMessage") || line.includes("setSuccessMessage") || line.includes("setToast") || line.includes("toast(")) {
      if (!line.includes("String") && !line.includes("`") && !line.includes('"') && !line.includes("'") && !line.includes("err.message")) {
        console.log(f + ":" + (idx+1) + " -> " + line.trim());
      }
    }
  });
}
