/**
 *
 * Create local NCEP Grib2 definitions for GRIB.jl
 *
 * This script parses various disciplines and category webpages from
 * NCEP and outputs definitions for GRIB messages for use with GRIB.jl
 *
 * See:
 * https://github.com/weech/GRIB.jl/issues/5
 * https://github.com/weech/GRIB.jl/issues/4
 *
 * Author: Rusty Conover (rusty@conover.me)
 *
 */
const bent = require("bent");
const get = bent("GET");
const zerofill = require("zero-fill");
import * as _ from "lodash";
import * as fs from "fs/promises";
import * as cheerio from "cheerio";
import { parseIsolatedEntityName } from "typescript";
const cheerioTableparser = require("cheerio-tableparser");

async function pull_category(
  discipline: number,
  category_number: number
): Promise<Array<[number, string, string, string]>> {
  const res = await get(
    `https://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_doc/grib2_table4-2-${discipline}-${category_number}.shtml`
  );

  const data = await res.text();

  const $ = cheerio.load(data);
  cheerioTableparser($);
  var data2 = $("table").parsetable(false, false, false);

  // Fixup the rows.
  const rows = [];
  for (let i = 1; i < data2[0].length; i++) {
    rows.push(
      [0, 1, 2, 3].map((x) => {
        const v = data2[x][i];

        if (x === 0) {
          let cleaned = v.replace("<br>", "").trim();
          if (cleaned.match(/^\d+$/)) {
            return parseInt(cleaned, 10);
          } else {
            return v;
          }
        } else if (x === 1 && v != null) {
          let cleaned = v
            .replace(/\n[ ]*/g, " ")
            .replace(/\n/g, " ")
            .replace("<br>", "")
            .replace(/\*\*\*/, "")
            .replace(/ *\(See Note.*?\)/i, "")
            .trim();
          return cleaned;
        } else if (x === 2 && v != null) {
          // Cleanup superscripts/subscripts.
          let cleaned = v
            .replace(/<sup>(.*?)<\/sup>/g, "**$1")
            .replace("<br>", "")
            .trim();
          return cleaned;
        } else if (x === 3 && v != null) {
          return v
            .replace("<br>", "")
            .replace(/\n[ ]*/g, " ")
            .replace(/\n/g, " ")
            .toLowerCase()
            .trim();
        }
        return v;
      })
    );
  }

  //  console.log(data2);
  //  console.log(rows);
  return rows;
}


const missing_messages: Array<number[]> = _.uniq([
  "0:16:3",
  "0:2:220",
  "0:2:221",
  "0:16:198",
  "0:7:199",
  "0:7:200",
  "0:7:199",
  "0:7:200",
  "0:7:199",
  "0:7:200",
  "0:1:74",
  "0:2:222",
  "0:2:223",
  "0:1:227",
  "0:1:242",
  "3:192:1",
  "3:192:2",
  "3:192:7",
  "3:192:8",
  "0:16:196",
"0:16:195",
"0:16:195",
"0:16:195",
"0:3:198",
"0:16:195",
"0:17:192",
"2:0:194",
"0:1:8",
"0:1:225",
"0:7:6",
"0:7:7",
"0:6:1",
"0:4:200",
"0:4:201",
"0:7:193",
"0:7:6",
"0:7:7",
"0:7:6",
"0:7:7",
"0:7:6",
"0:7:7",
"0:3:200",
]).map((x) => x.split(/:/).map((x) => parseInt(x, 10)));

console.log(
  "Looking up missing definitions for: (discipline, parameterCategory, parameterNumber)"
);
console.log(missing_messages);

let names = "";
let params = "";
let short_name = "";
let units = "";

async function load_definitions() {
  const disciplines: Map<number, any> = new Map();

  for (const discipline of _.uniq(missing_messages.map((v) => v[0]))) {
    for (const category of _.uniq(
      _.filter(missing_messages, (v) => v[0] === discipline).map((v) => v[1])
    )) {
      const category_contents = await pull_category(discipline, category);

      const missing_rows = _.filter(
        missing_messages,
        (v) => v[0] === discipline && v[1] === category
      );

      for (const row of missing_rows) {
        const schema = category_contents.find((v) => v[0] === row[2]);
        if (schema == null) {
          throw new Error(
            `ERROR did not find discipline=${discipline} category=${category} id=${row[2]}`
          );
        } else {
          names += `#${schema[1]}
'${schema[1]}' = {
    discipline = ${row[0]};
    parameterCategory = ${row[1]};
    parameterNumber = ${row[2]};
}

`;

          params += `#${schema[1]}
'7${row[0]}${zerofill(3, row[1])}${zerofill(3, row[2])}' = {
    discipline = ${row[0]};
    parameterCategory = ${row[1]};
    parameterNumber = ${row[2]};
}

`;

          short_name += `#${schema[1]}
'${schema[3]}' = {
    discipline = ${row[0]};
    parameterCategory = ${row[1]};
    parameterNumber = ${row[2]};
}

`;
          units += `#${schema[1]}
'${schema[2]}' = {
    discipline = ${row[0]};
    parameterCategory = ${row[1]};
    parameterNumber = ${row[2]};
}

`;
        }
      }
    }
  }

  await fs.writeFile("name.def", names);
  await fs.writeFile("paramId.def", params);
  await fs.writeFile("shortName.def", short_name);
  await fs.writeFile("units.def", units);
  console.log(
    "Write output to name.def, paramId.def, shortName.def, units.def"
  );
}

load_definitions().catch((e) => {
  console.error("Got an error");
  console.error(e);
});
