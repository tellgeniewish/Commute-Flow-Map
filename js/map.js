// ============================================================
// 1. 지도 생성
// ============================================================

const map = L.map("map").setView(
  [37.2, 127.0],
  8
);


// ============================================================
// 2. 배경 지도
// ============================================================

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);


// ============================================================
// 3. 서울·인천·경기 대표 좌표
// ============================================================

const centers = {

  "서울특별시": [
    37.5665,
    126.9780
  ],

  "인천광역시": [
    37.4563,
    126.7052
  ],

  "경기도": [
    37.2750,
    127.0095
  ]

};


// ============================================================
// 4. KOSIS JSON 불러오기
// ============================================================

fetch("./data/capital_2020.json")

  .then(response => response.json())

  .then(data => {

    console.log("원본 데이터:", data);

    // --------------------------------------------------------
    // 5. 전체 통근통학인구(T1)만 선택
    // --------------------------------------------------------

    const flows = data.filter(d =>

      d.ITM_ID === "T1" &&

      d.C1_NM !== "계" &&
      d.C2_NM !== "계" &&

      d.C2_NM !== "기타" &&

      d.C1_NM !== d.C2_NM &&

      centers[d.C1_NM] &&
      centers[d.C2_NM]

    );

    console.log("지도용 데이터:", flows);


    // --------------------------------------------------------
    // 6. 지역 표시
    // --------------------------------------------------------

    Object.entries(centers).forEach(([name, coords]) => {

      L.circleMarker(
        coords,
        {
          radius: 8,
          fillOpacity: 0.9,
          weight: 2
        }
      )

        .addTo(map)

        .bindTooltip(
          name,
          {
            permanent: true,
            direction: "top"
          }
        );

    });


    // --------------------------------------------------------
    // 7. 통근·통학 이동선 표시
    // --------------------------------------------------------

    flows.forEach(flow => {

      const origin =
        centers[flow.C1_NM];

      const destination =
        centers[flow.C2_NM];

      const value =
        Number(flow.DT);


      // 이동량에 따라 선 굵기 설정
      const weight =
        Math.max(
          2,
          Math.sqrt(value) / 350
        );


      const line = L.polyline(

        [
          origin,
          destination
        ],

        {
          weight: weight,
          opacity: 0.7,
          dashArray: "10 12"
        }

      ).addTo(map);


      line.bindPopup(

        `
        <strong>
          ${flow.C1_NM}
          →
          ${flow.C2_NM}
        </strong>

        <br>

        통근·통학 인구:
        ${value.toLocaleString()}명
        `

      );

    });

  })

  .catch(error => {

    console.error(
      "데이터 로딩 오류:",
      error
    );

  });