// ============================================================
// 1. 지도 생성
// ============================================================

const map = L.map("map", {
  zoomControl: true,
  attributionControl: true
});

// 수도권 중심
map.setView([37.45, 126.95], 8);


// ============================================================
// 2. 배경지도
// ============================================================

// 기존 OSM보다 조금 덜 튀게 보이도록 투명도 낮춤
const baseMap = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 18,
    opacity: 0.35,
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);


// ============================================================
// 3. 현재 분석 대상 지역
// ============================================================

const selectedRegions = [
  "서울특별시",
  "인천광역시",
  "경기도"
];


// ============================================================
// 4. KOSIS 이동선용 대표 좌표
// ============================================================

const centers = {
  "서울특별시": [37.5665, 126.9780],
  "인천광역시": [37.4563, 126.7052],
  "경기도": [37.2750, 127.0095]
};


// ============================================================
// 5. GeoJSON 불러오기
// ============================================================

fetch("./geo/korea_sido.geojson")
  .then(response => {
    if (!response.ok) {
      throw new Error("GeoJSON 파일을 불러오지 못했습니다.");
    }

    return response.json();
  })
  .then(geoData => {

    // --------------------------------------------------------
    // 기본 스타일
    // --------------------------------------------------------

    function getRegionStyle(feature) {

      const name =
        feature.properties.CTP_KOR_NM;

      const selected =
        selectedRegions.includes(name);

      return {

        // 경계선
        color: selected
          ? "#8fb8bd"
          : "#cfcfcf",

        weight: selected
          ? 1.6
          : 1,

        // 내부 색상
        fillColor: selected
          ? "#c8eee6"
          : "#eeeeee",

        fillOpacity: selected
          ? 0.55
          : 0.55

      };

    }


    // --------------------------------------------------------
    // hover 이벤트
    // --------------------------------------------------------

    function onEachRegion(feature, layer) {

      const name =
        feature.properties.CTP_KOR_NM;

      const selected =
        selectedRegions.includes(name);


      // 지역명 표시
      layer.bindTooltip(
        name,
        {
          sticky: true,
          direction: "top",
          className: "region-tooltip"
        }
      );


      // 마우스 올렸을 때
      layer.on("mouseover", function () {

        layer.setStyle({

          fillColor: selected
            ? "#9fd8cc"
            : "#dddddd",  // 기존보다 훨씬 연한 회색

          fillOpacity: selected
            ? 0.8
            : 0.7,

          color: selected
            ? "#557d68"
            : "#999999",

          weight: 2

        });

        layer.bringToFront();

      });


      // 마우스 뗐을 때
      layer.on("mouseout", function () {

        layer.setStyle(
          getRegionStyle(feature)
        );

      });

    }


    // --------------------------------------------------------
    // GeoJSON 지도 추가
    // --------------------------------------------------------

    const regionLayer =
      L.geoJSON(
        geoData,
        {
          style: getRegionStyle,
          onEachFeature: onEachRegion
        }
      ).addTo(map);


    // --------------------------------------------------------
    // 수도권 화면 범위 자동 맞춤
    // --------------------------------------------------------

    const capitalFeatures =
      geoData.features.filter(feature =>
        selectedRegions.includes(
          feature.properties.CTP_KOR_NM
        )
      );


    const capitalLayer =
      L.geoJSON(capitalFeatures);


    map.fitBounds(
      capitalLayer.getBounds(),
      {
        padding: [30, 30]
      }
    );


    // --------------------------------------------------------
    // GeoJSON 위에 KOSIS 이동선 추가
    // --------------------------------------------------------

    loadCommuteFlows();

  })

  .catch(error => {

    console.error(
      "GeoJSON 로딩 오류:",
      error
    );

  });


// ============================================================
// 6. KOSIS 통근·통학 데이터 불러오기
// ============================================================

function loadCommuteFlows() {

  fetch("./data/capital_2020.json")

    .then(response => {

      if (!response.ok) {
        throw new Error(
          "capital_2020.json을 불러오지 못했습니다."
        );
      }

      return response.json();

    })

    .then(data => {

      console.log(
        "KOSIS 원본 데이터:",
        data
      );


      // ------------------------------------------------------
      // T1 = 전체 통근통학인구
      //
      // 계/기타 제거
      // 동일 지역 → 동일 지역 제거
      // ------------------------------------------------------

      const flows =
        data.filter(d =>

          d.ITM_ID === "T1" &&

          d.C1_NM !== "계" &&
          d.C2_NM !== "계" &&

          d.C2_NM !== "기타" &&

          d.C1_NM !== d.C2_NM &&

          centers[d.C1_NM] &&
          centers[d.C2_NM]

        );


      console.log(
        "지도용 이동 데이터:",
        flows
      );


      // ------------------------------------------------------
      // 이동선 표시
      // ------------------------------------------------------

      flows.forEach(flow => {

        const origin =
          centers[flow.C1_NM];

        const destination =
          centers[flow.C2_NM];

        const value =
          Number(flow.DT);


        // 이동량이 많을수록 약간 굵게
        const weight =
          Math.max(
            2,
            Math.min(
              8,
              Math.sqrt(value) / 300
            )
          );


        const line =
          L.polyline(
            [
              origin,
              destination
            ],
            {
              color: "#4b8fb3",
              weight: weight,
              opacity: 0.7,
              dashArray: "8 10"
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


      // ------------------------------------------------------
      // 지역 대표점
      // ------------------------------------------------------

      Object.entries(
        centers
      ).forEach(
        ([name, coords]) => {

          L.circleMarker(
            coords,
            {
              radius: 5,
              color: "#35657f",
              fillColor: "#ffffff",
              fillOpacity: 1,
              weight: 2
            }
          )
            .addTo(map)
            .bindTooltip(
              name,
              {
                direction: "top"
              }
            );

        }
      );

    })

    .catch(error => {

      console.error(
        "KOSIS 데이터 로딩 오류:",
        error
      );

    });

}