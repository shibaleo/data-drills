import {
  parsePdfFilename,
} from "../src/lib/pdf-processing";

const testFiles = [
  // Training
  "トレーニング_010_簿記一巡の手続ー１_(概要、大陸式と英米式、開始手続等)（簿記論）_2026.pdf",
  "トレーニング_019-2_一般商品売買２ー５_(売価還元法)（財表）_2026.pdf",
  // Theme exercise
  "2026_簿記_テーマ別演習01(一般商品売買１).pdf",
  "2026_財表_テーマ別演習02(一般商品売買、諸税金).pdf",
  "2026_財表_テーマ別演習03(財務会計総論Ⅰ、現金預金).pdf",
  // Skill test
  "2025簿記論_実力テスト_第１回_01問題.pdf",
  "2025財表_実力テスト_第１回_02答案用紙.pdf",
];

for (const f of testFiles) {
  const result = parsePdfFilename(f);
  if (result) {
    console.log(`OK  ${f}`);
    console.log(`    code=${result.code} sub=${result.subjectName} lvl=${result.levelCode} role=${result.fileRole} topic=${result.subtopic}`);
  } else {
    console.log(`FAIL  ${f}`);
  }
}
