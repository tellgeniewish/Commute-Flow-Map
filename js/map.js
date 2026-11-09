// ============================================================
// 1. 지도 생성
// ============================================================

const map = L.map("map", {
  zoomControl: true,
  attributionControl: true
});

map.setView([37.45, 126.95], 8);


// ============================================================
// 2. 배경지도
// ============================================================

L.tileLayer(
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
// 4. OD 대표 좌표
// ============================================================

const centers = {
  "서울특별시": [37.5665, 126.9780],
  "인천광역시": [37.4563, 126.7052],
  "경기도": [37.2750, 127.0095]
};


// ============================================================
// 5. 두 지점 사이의 곡선 좌표 생성
// ============================================================

function createCurvePoints(
  origin,
  destination,
  bend = 0.25,
  steps = 100
) {

  const lat1 = origin[0];
  const lng1 = origin[1];

  const lat2 = destination[0];
  const lng2 = destination[1];


  // 두 점의 중간
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;


  // 방향 벡터
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;


  // 진행 방향의 수직 방향으로 제어점 이동
  // A→B와 B→A가 서로 반대쪽으로 휘게 됨
  const controlLat =
    midLat + dLng * bend;

  const controlLng =
    midLng - dLat * bend;


  const points = [];


  // Quadratic Bezier
  for (let i = 0; i <= steps; i++) {

    const t = i / steps;

    const oneMinusT = 1 - t;


    const lat =
      oneMinusT * oneMinusT * lat1 +
      2 * oneMinusT * t * controlLat +
      t * t * lat2;


    const lng =
      oneMinusT * oneMinusT * lng1 +
      2 * oneMinusT * t * controlLng +
      t * t * lng2;


    points.push([lat, lng]);

  }


  return points;
}


// ============================================================
// 6. 이동량에 따라 애니메이션 점 개수 결정
// ============================================================

function getParticleCount(value) {

  if (value >= 1000000) {
    return 4;
  }

  if (value >= 500000) {
    return 3;
  }

  if (value >= 150000) {
    return 2;
  }

  return 1;
}


// ============================================================
// 7. 이동량에 따라 점 이동 속도 결정
// ============================================================

function getAnimationDuration(value) {

  if (value >= 1000000) {
    return 4200;
  }

  if (value >= 500000) {
    return 4800;
  }

  if (value >= 150000) {
    return 5400;
  }

  return 6200;
}


// ============================================================
// 8. 움직이는 점 생성
// ============================================================

function animateParticle(
  points,
  duration,
  phase = 0
) {

  const marker =
    L.circleMarker(
      points[0],
      {
        radius: 4,

        color: "#ffffff",
        weight: 1,

        fillColor: "#238ca5",
        fillOpacity: 0.95,

        interactive: false
      }
    ).addTo(map);


  function frame(timestamp) {

    // phase를 이용해 여러 점의 출발 시점을 분산
    const progress =
      ((timestamp / duration) + phase) % 1;


    const position =
      progress * (points.length - 1);


    const index =
      Math.floor(position);


    const nextIndex =
      Math.min(
        index + 1,
        points.length - 1
      );


    const fraction =
      position - index;


    // 점과 점 사이를 다시 보간해서
    // 움직임을 부드럽게 처리
    const lat =
      points[index][0] +
      (
        points[nextIndex][0] -
        points[index][0]
      ) * fraction;


    const lng =
      points[index][1] +
      (
        points[nextIndex][1] -
        points[index][1]
      ) * fraction;


    marker.setLatLng(
      [lat, lng]
    );


    requestAnimationFrame(frame);

  }


  requestAnimationFrame(frame);
}


// ============================================================
// 9. GeoJSON 불러오기
// ============================================================

fetch("./geo/korea_sido.geojson")

  .then(response => {

    if (!response.ok) {

      throw new Error(
        "GeoJSON 파일을 불러오지 못했습니다."
      );

    }

    return response.json();

  })

  .then(geoData => {


    // --------------------------------------------------------
    // 지역 기본 스타일
    // --------------------------------------------------------

    function getRegionStyle(feature) {

      const name =
        feature.properties.CTP_KOR_NM;


      const selected =
        selectedRegions.includes(name);


      return {

        color:
          selected
            ? "#8fb8bd"
            : "#cfcfcf",

        weight:
          selected
            ? 1.6
            : 1,

        fillColor:
          selected
            ? "#c8eee6"
            : "#eeeeee",

        fillOpacity: 0.55

      };

    }


    // --------------------------------------------------------
    // 지역 hover
    // --------------------------------------------------------

    function onEachRegion(
      feature,
      layer
    ) {

      const name =
        feature.properties.CTP_KOR_NM;


      const selected =
        selectedRegions.includes(name);


      layer.bindTooltip(
        name,
        {
          sticky: true,
          direction: "top",
          className: "region-tooltip"
        }
      );


      layer.on(
        "mouseover",
        function () {

          layer.setStyle({

            fillColor:
              selected
                ? "#9fd8cc"
                : "#dddddd",

            fillOpacity:
              selected
                ? 0.8
                : 0.7,

            color:
              selected
                ? "#557d68"
                : "#999999",

            weight: 2

          });

        }
      );


      layer.on(
        "mouseout",
        function () {

          layer.setStyle(
            getRegionStyle(feature)
          );

        }
      );

    }


    // --------------------------------------------------------
    // GeoJSON 추가
    // --------------------------------------------------------

    L.geoJSON(
      geoData,
      {
        style: getRegionStyle,
        onEachFeature: onEachRegion
      }
    ).addTo(map);


    // --------------------------------------------------------
    // 수도권 범위
    // --------------------------------------------------------

    const capitalFeatures =
      geoData.features.filter(
        feature =>
          selectedRegions.includes(
            feature.properties.CTP_KOR_NM
          )
      );


    const capitalLayer =
      L.geoJSON(
        capitalFeatures
      );


    map.fitBounds(
      capitalLayer.getBounds(),
      {
        padding: [30, 30]
      }
    );


    // --------------------------------------------------------
    // OD 데이터 불러오기
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
// 10. KOSIS OD 데이터 불러오기
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
      // T1 전체 통근통학 인구만 사용
      //
      // 계 제거
      // 기타 제거
      // 동일 지역 내부이동 제거
      // ------------------------------------------------------

      const flows =
        data.filter(
          d =>

            d.ITM_ID === "T1" &&

            d.C1_NM !== "계" &&
            d.C2_NM !== "계" &&

            d.C1_NM !== "기타" &&
            d.C2_NM !== "기타" &&

            d.C1_NM !== d.C2_NM &&

            centers[d.C1_NM] &&
            centers[d.C2_NM]
        );


      console.log(
        "지도용 OD 데이터:",
        flows
      );


      // ------------------------------------------------------
      // OD별 곡선 + 애니메이션
      // ------------------------------------------------------

      flows.forEach(flow => {


        const origin =
          centers[flow.C1_NM];


        const destination =
          centers[flow.C2_NM];


        const value =
          Number(flow.DT);


        // 곡선 생성
        const curvePoints =
          createCurvePoints(
            origin,
            destination,
            0.28,
            120
          );


        // 이동량 기반 선 굵기
        const weight =
          Math.max(
            2,
            Math.min(
              7,
              Math.sqrt(value) / 300
            )
          );


        // 곡선 표시
        const line =
          L.polyline(
            curvePoints,
            {
              color: "#4b9bb0",

              weight: weight,

              opacity: 0.55
            }
          ).addTo(map);


        // ----------------------------------------------------
        // Popup
        // ----------------------------------------------------

        line.bindPopup(
          `
          <strong>
            ${flow.C1_NM}
            →
            ${flow.C2_NM}
          </strong>

          <br><br>

          통근·통학 인구:
          <strong>
            ${value.toLocaleString()}명
          </strong>
          `
        );


        // ----------------------------------------------------
        // 움직이는 점
        // ----------------------------------------------------

        const particleCount =
          getParticleCount(value);


        const duration =
          getAnimationDuration(value);


        for (
          let i = 0;
          i < particleCount;
          i++
        ) {

          animateParticle(
            curvePoints,
            duration,

            // 0 ~ 1 사이에 균등 배치
            i / particleCount
          );

        }

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