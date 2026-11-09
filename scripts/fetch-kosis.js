const fs = require("fs");
const path = require("path");

const apiKey = process.env.KOSIS_API_KEY;

if (!apiKey) {
  throw new Error("KOSIS_API_KEY가 설정되지 않았습니다.");
}

const params = new URLSearchParams({
  method: "getList",

  apiKey,

  // 항목
  itmId: "T1+T2+T3+",

  // 현 거주지
  objL1: "00+11+23+31+",

  // 통근통학지
  objL2: "00+11+23+31+90+99+",

  objL3: "",
  objL4: "",
  objL5: "",
  objL6: "",
  objL7: "",
  objL8: "",

  format: "json",
  jsonVD: "Y",

  // 2020년 자료
  prdSe: "F",
  newEstPrdCnt: "1",

  outputFields:
    "ORG_ID+TBL_ID+TBL_NM+OBJ_ID+OBJ_NM+OBJ_NM_ENG+NM+NM_ENG+ITM_ID+ITM_NM+ITM_NM_ENG+UNIT_NM+UNIT_NM_ENG+PRD_SE+PRD_DE+LST_CHN_DE+",

  orgId: "101",

  // 수도권 통근통학 표
  tblId: "DT_1PA2005"
});

const url =
  "https://kosis.kr/openapi/Param/statisticsParameterData.do?" +
  params.toString();

async function main() {
  console.log("KOSIS API 호출 중...");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `KOSIS API HTTP 오류: ${response.status}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      `KOSIS API 오류: ${JSON.stringify(data)}`
    );
  }

  const outputPath = path.join(
    process.cwd(),
    "data",
    "capital_2020.json"
  );

  fs.mkdirSync(
    path.dirname(outputPath),
    { recursive: true }
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  console.log(
    `${data.length}개 데이터를 ${outputPath}에 저장했습니다.`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});