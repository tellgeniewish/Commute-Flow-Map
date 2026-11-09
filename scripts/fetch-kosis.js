const fs = require("fs");
const path = require("path");

const apiKey = process.env.KOSIS_API_KEY;

if (!apiKey) {
  throw new Error(
    "KOSIS_API_KEY가 설정되지 않았습니다."
  );
}


// ============================================================
// 1. 권역별 KOSIS 설정
// ============================================================

const configs = [

  // 서울·인천·경기
  {
    name: "서울·인천·경기",

    tblId: "DT_1PA2005",

    objL1:
      "00+11+23+31+",

    objL2:
      "00+11+23+31+90+99+",

    outputFile:
      "capital_2020.json"
  },


  // 부산·울산·경남
  {
    name: "부산·울산·경남",

    tblId: "DT_1PA2006",

    objL1:
      "00+21+26+38+",

    objL2:
      "00+21+26+38+90+99+",

    outputFile:
      "busan_ulsan_gyeongnam_2020.json"
  }

];


// ============================================================
// 2. KOSIS API URL 생성
//
// 중요:
// KOSIS의 + 구분자를 그대로 유지해야 하므로
// URLSearchParams를 사용하지 않는다.
// ============================================================

function createKosisUrl(config) {

  return (

    "https://kosis.kr/openapi/Param/statisticsParameterData.do" +

    "?method=getList" +

    `&apiKey=${encodeURIComponent(apiKey)}` +

    "&itmId=T1+T2+T3+" +

    `&objL1=${config.objL1}` +

    `&objL2=${config.objL2}` +

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

    `&tblId=${config.tblId}`

  );

}


// ============================================================
// 3. 권역별 데이터 수집
// ============================================================

async function fetchRegion(config) {

  console.log(
    `${config.name} KOSIS API 호출 중...`
  );


  const url =
    createKosisUrl(config);


  const response =
    await fetch(url);


  if (!response.ok) {

    throw new Error(
      `${config.name} HTTP 오류: ${response.status}`
    );

  }


  const data =
    await response.json();


  if (!Array.isArray(data)) {

    throw new Error(
      `${config.name} API 오류: ${JSON.stringify(data)}`
    );

  }


  if (data.length === 0) {

    throw new Error(
      `${config.name} 데이터가 반환되지 않았습니다.`
    );

  }


  // ==========================================================
  // 응답 구조 검증
  // ==========================================================

  const sample =
    data.find(
      row =>
        row.C1_NM &&
        row.C2_NM &&
        row.ITM_ID &&
        row.DT
    );


  if (!sample) {

    console.error(
      `${config.name} API 응답 예시:`,
      data[0]
    );


    throw new Error(
      `${config.name} API 응답에 C1_NM, C2_NM, ITM_ID, DT가 없습니다.`
    );

  }


  console.log(
    `${config.name} 응답 데이터 수:`,
    data.length
  );


  console.log(
    `${config.name} 응답 예시:`,
    sample
  );


  // ==========================================================
  // JSON 저장
  // ==========================================================

  const outputPath =
    path.join(
      process.cwd(),
      "data",
      config.outputFile
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
    `${config.name}: ${data.length}개 데이터를 ${outputPath}에 저장했습니다.`
  );

}


// ============================================================
// 4. 전체 권역 실행
// ============================================================

async function main() {

  for (const config of configs) {

    await fetchRegion(config);

  }

}


main().catch(error => {

  console.error(error);

  process.exit(1);

});