const fs = require("fs");
const path = require("path");

const apiKey = process.env.KOSIS_API_KEY;

if (!apiKey) {
  throw new Error(
    "KOSIS_API_KEY가 설정되지 않았습니다."
  );
}


// ============================================================
// KOSIS API URL
//
// 중요:
// KOSIS에서 사용하는 + 구분자를 그대로 유지하기 위해
// URLSearchParams를 사용하지 않는다.
// ============================================================

const url =
  "https://kosis.kr/openapi/Param/statisticsParameterData.do" +
  "?method=getList" +
  `&apiKey=${encodeURIComponent(apiKey)}` +
  "&itmId=T1+T2+T3+" +
  "&objL1=00+11+23+31+" +
  "&objL2=00+11+23+31+90+99+" +
  "&objL3=" +
  "&objL4=" +
  "&objL5=" +
  "&objL6=" +
  "&objL7=" +
  "&objL8=" +
  "&format=json" +
  "&jsonVD=Y" +
  "&prdSe=F" +
  "&newEstPrdCnt=3" +
  "&outputFields=" +
    "ORG_ID+TBL_ID+TBL_NM+" +
    "OBJ_ID+OBJ_NM+OBJ_NM_ENG+" +
    "NM+NM_ENG+" +
    "ITM_ID+ITM_NM+ITM_NM_ENG+" +
    "UNIT_NM+UNIT_NM_ENG+" +
    "PRD_SE+PRD_DE+LST_CHN_DE+" +
  "&orgId=101" +
  "&tblId=DT_1PA2005";


async function main() {

  console.log(
    "KOSIS API 호출 중..."
  );


  const response =
    await fetch(url);


  if (!response.ok) {

    throw new Error(
      `KOSIS API HTTP 오류: ${response.status}`
    );

  }


  const data =
    await response.json();


  if (!Array.isArray(data)) {

    throw new Error(
      `KOSIS API 오류: ${JSON.stringify(data)}`
    );

  }


  if (data.length === 0) {

    throw new Error(
      "KOSIS API에서 데이터가 반환되지 않았습니다."
    );

  }


  // ==========================================================
  // 응답 구조 검증
  // ==========================================================

  const sample =
    data.find(row =>
      row.C1_NM &&
      row.C2_NM &&
      row.ITM_ID &&
      row.DT
    );


  if (!sample) {

    console.error(
      "API 응답 예시:",
      data[0]
    );

    throw new Error(
      "KOSIS API 응답에 C1_NM, C2_NM, ITM_ID, DT가 없습니다."
    );

  }


  console.log(
    "응답 데이터 수:",
    data.length
  );


  console.log(
    "응답 예시:",
    sample
  );


  // ==========================================================
  // JSON 저장
  // ==========================================================

  const outputPath =
    path.join(
      process.cwd(),
      "data",
      "capital_2020.json"
    );


  fs.mkdirSync(
    path.dirname(outputPath),
    {
      recursive: true
    }
  );


  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      data,
      null,
      2
    ),
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