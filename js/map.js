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
// 3. 권역별 설정
// ============================================================

const regionConfigs = {

  capital: {

    label:
      "서울·인천·경기",

    regions: [
      "서울특별시",
      "인천광역시",
      "경기도"
    ],

    centers: {
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
    },

    dataFile:
      "./data/capital_2020.json"

  },


  southeast: {

    label:
      "부산·울산·경남",

    regions: [
      "부산광역시",
      "울산광역시",
      "경상남도"
    ],

    centers: {
      "부산광역시": [
        35.1796,
        129.0756
      ],

      "울산광역시": [
        35.5384,
        129.3114
      ],

      "경상남도": [
        35.2383,
        128.6924
      ]
    },

    dataFile:
      "./data/busan_ulsan_gyeongnam_2020.json"

  }

};


// ============================================================
// URL에서 현재 권역 확인
// ============================================================

const urlParams =
  new URLSearchParams(
    window.location.search
  );


const requestedRegion =
  urlParams.get("region");


const currentRegionKey =
  regionConfigs[requestedRegion]
    ? requestedRegion
    : "capital";


const currentConfig =
  regionConfigs[currentRegionKey];


const selectedRegions =
  currentConfig.regions;


const centers =
  currentConfig.centers;


// 지역별 유입 통근·통학 인구
let inflowByRegion = {};
// 유출
let outflowByRegion = {};

// ============================================================
// 권역 선택 드롭다운
// ============================================================

const regionSelect =
  document.getElementById(
    "regionSelect"
  );


if (regionSelect) {

  regionSelect.value =
    currentRegionKey;


  regionSelect.addEventListener(
    "change",
    event => {

      const regionKey =
        event.target.value;


      window.location.search =
        `?region=${regionKey}`;

    }
  );

}

// ============================================================
// 5. 목적지로 부드럽게 휘어 들어가는 이동 경로
// ============================================================

function createCurvePoints(
  origin,
  destination,
  bend = 0.22,
  steps = 160
) {

  const lat1 = origin[0];
  const lng1 = origin[1];

  const lat2 = destination[0];
  const lng2 = destination[1];


  const dLat =
    lat2 - lat1;

  const dLng =
    lng2 - lng1;


  const distance =
    Math.sqrt(
      dLat * dLat +
      dLng * dLng
    ) || 1;


  // 진행 방향의 오른쪽 방향 단위벡터
  const rightLat =
    dLng / distance;

  const rightLng =
    -dLat / distance;


  // ----------------------------------------------------------
  // 제어점
  //
  // 출발 → 살짝 오른쪽으로 휨 → destination으로 수렴
  // ----------------------------------------------------------

  const midLat =
    (lat1 + lat2) / 2;

  const midLng =
    (lng1 + lng2) / 2;


  const controlLat =
    midLat +
    rightLat *
    distance *
    bend;

  const controlLng =
    midLng +
    rightLng *
    distance *
    bend;


  const points = [];


  // Quadratic Bezier
  for (
    let i = 0;
    i <= steps;
    i++
  ) {

    const t =
      i / steps;

    const oneMinusT =
      1 - t;


    const lat =
      oneMinusT *
      oneMinusT *
      lat1 +

      2 *
      oneMinusT *
      t *
      controlLat +

      t *
      t *
      lat2;


    const lng =
      oneMinusT *
      oneMinusT *
      lng1 +

      2 *
      oneMinusT *
      t *
      controlLng +

      t *
      t *
      lng2;


    points.push(
      [lat, lng]
    );

  }


  return points;
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
// 흐르는 유선형 화살표
// ============================================================

function animateFlowArrow(
  points,
  duration,
  style,
  delay = 0
) {

  // 하나의 OD당 하나의 Canvas 생성
  const canvas =
    L.DomUtil.create(
      "canvas",
      "flow-canvas"
    );

  const size =
    map.getSize();


  canvas.width =
    size.x;

  canvas.height =
    size.y;


  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.zIndex = "450";
  canvas.style.pointerEvents = "none";


  map.getContainer()
  .appendChild(canvas);


  const ctx =
    canvas.getContext("2d");


  // ----------------------------------------------------------
  // 화면 크기 변경
  // ----------------------------------------------------------

  function resizeCanvas() {

    const newSize =
      map.getSize();


    canvas.width =
      newSize.x;

    canvas.height =
      newSize.y;

  }


  map.on(
    "resize zoom move",
    resizeCanvas
  );


  // ----------------------------------------------------------
  // 화살표 그리기
  // ----------------------------------------------------------

  function drawArrow(progress) {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  const total =
    points.length;


  const headIndex =
    Math.floor(
      progress * (total - 1)
    );


  const tailLength =
    Math.max(
      16,
      Math.floor(total * 0.40)
    );


  const startIndex =
    Math.max(
      0,
      headIndex - tailLength
    );


  if (
    headIndex <= startIndex + 4
  ) {
    return;
  }


  // ==========================================================
  // 화면 좌표로 변환
  // ==========================================================

  const visiblePoints = [];

  for (
    let i = startIndex;
    i <= headIndex;
    i++
  ) {

    visiblePoints.push(
      map.latLngToContainerPoint(
        points[i]
      )
    );

  }


  if (
    visiblePoints.length < 5
  ) {
    return;
  }


  // ==========================================================
  // 하나의 화살표 Polygon 생성
  // ==========================================================

  const leftSide = [];
  const rightSide = [];


  const bodyEnd =
    visiblePoints.length - 2;


  for (
    let i = 0;
    i < bodyEnd;
    i++
  ) {

    const current =
      visiblePoints[i];


    const next =
      visiblePoints[
        Math.min(
          i + 1,
          visiblePoints.length - 1
        )
      ];


    const dx =
      next.x - current.x;

    const dy =
      next.y - current.y;


    const length =
      Math.sqrt(
        dx * dx +
        dy * dy
      ) || 1;


    // 진행 방향에 수직인 벡터
    const nx =
      -dy / length;

    const ny =
      dx / length;


    const ratio =
      i / bodyEnd;


    // 꼬리는 얇고
    // 머리 쪽으로 갈수록 자연스럽게 두꺼워짐
    const halfWidth =
      0.4 +
      ratio *
      style.lineWeight *
      0.75;


    leftSide.push({
      x:
        current.x +
        nx * halfWidth,

      y:
        current.y +
        ny * halfWidth
    });


    rightSide.push({
      x:
        current.x -
        nx * halfWidth,

      y:
        current.y -
        ny * halfWidth
    });

  }


  // ==========================================================
  // 머리 부분 계산
  // ==========================================================

  const head =
    visiblePoints[
      visiblePoints.length - 1
    ];


  // ==========================================================
  // 화살표 머리 방향
  // 출발지 → 도착지 전체 방향을 고정해서 사용
  // ==========================================================

  const start =
    map.latLngToContainerPoint(
      points[0]
    );

  const end =
    map.latLngToContainerPoint(
      points[points.length - 1]
    );


  const dx =
    end.x - start.x;

  const dy =
    end.y - start.y;


  const length =
    Math.sqrt(
      dx * dx +
      dy * dy
    ) || 1;


  const ux =
    dx / length;

  const uy =
    dy / length;


  const nx =
    -uy;

  const ny =
    ux;

  const arrowLength =
    style.arrowSize * 1.35;


  const arrowHalfWidth =
    style.arrowSize * 0.52;


  // 화살촉 끝
  const tip = {
    x:
      head.x +
      ux * arrowLength,

    y:
      head.y +
      uy * arrowLength
  };


  // 머리 좌측
  const headLeft = {
    x:
      head.x +
      nx * arrowHalfWidth,

    y:
      head.y +
      ny * arrowHalfWidth
  };


  // 머리 우측
  const headRight = {
    x:
      head.x -
      nx * arrowHalfWidth,

    y:
      head.y -
      ny * arrowHalfWidth
  };


  // ==========================================================
  // 꼬리 + 몸통 + 머리를 하나의 Path로 그리기
  // ==========================================================

  ctx.beginPath();


  ctx.moveTo(
    leftSide[0].x,
    leftSide[0].y
  );


  // 왼쪽 몸통
  for (
    let i = 1;
    i < leftSide.length;
    i++
  ) {

    ctx.lineTo(
      leftSide[i].x,
      leftSide[i].y
    );

  }


  // 머리 왼쪽
  ctx.lineTo(
    headLeft.x,
    headLeft.y
  );


  // 화살촉
  ctx.lineTo(
    tip.x,
    tip.y
  );


  // 머리 오른쪽
  ctx.lineTo(
    headRight.x,
    headRight.y
  );


  // 오른쪽 몸통 역순
  for (
    let i =
      rightSide.length - 1;

    i >= 0;
    i--
  ) {

    ctx.lineTo(
      rightSide[i].x,
      rightSide[i].y
    );

  }


  ctx.closePath();


  // ==========================================================
  // 은은한 그라데이션
  // ==========================================================

  const tail =
    visiblePoints[0];


  const gradient =
    ctx.createLinearGradient(
      tail.x,
      tail.y,
      tip.x,
      tip.y
    );


  gradient.addColorStop(
    0,
    hexToRgba(
      style.color,
      0.04
    )
  );


  gradient.addColorStop(
    0.45,
    hexToRgba(
      style.color,
      0.20
    )
  );


  gradient.addColorStop(
    1,
    hexToRgba(
      style.color,
      0.58
    )
  );


  ctx.fillStyle =
    gradient;


  ctx.fill();

}


  // ----------------------------------------------------------
  // 애니메이션
  // ----------------------------------------------------------

  function frame(timestamp) {

    const progress =
      (
        (timestamp + delay) % duration
      ) /
      duration;


    drawArrow(progress);


    requestAnimationFrame(
      frame
    );

  }


  requestAnimationFrame(
    frame
  );

}

function hexToRgba(
  hex,
  alpha
) {

  const value =
    hex.replace(
      "#",
      ""
    );


  const r =
    parseInt(
      value.substring(0, 2),
      16
    );


  const g =
    parseInt(
      value.substring(2, 4),
      16
    );


  const b =
    parseInt(
      value.substring(4, 6),
      16
    );


  return `rgba(${r}, ${g}, ${b}, ${alpha})`;

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
        () => {

          const inflow = inflowByRegion[name] || 0;
          const outflow = outflowByRegion[name] || 0;

          if (selectedRegions.includes(name)) {

            return `
              <div class="region-tooltip-name">
                ${name} 통근·통학 인구
              </div>

              <div class="region-tooltip-label">
                유입
              </div>

              <div class="region-tooltip-value">
                ${inflow.toLocaleString()}명
              </div>

              <div class="region-tooltip-label">
                유출
              </div>

              <div class="region-tooltip-value">
                ${outflow.toLocaleString()}명
              </div>
            `;

          }


          return name;

        },
        {
          sticky: true,
          direction: "top",
          offset: [12, -10],
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
    // 현재 선택 권역 범위
    // --------------------------------------------------------

    const selectedFeatures =
      geoData.features.filter(
        feature =>
          selectedRegions.includes(
            feature.properties.CTP_KOR_NM
          )
      );


    const selectedLayer =
      L.geoJSON(
        selectedFeatures
      );


    map.fitBounds(
      selectedLayer.getBounds(),
      {
        padding: [
          30,
          30
        ]
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

  fetch(currentConfig.dataFile)

    .then(response => {

      if (!response.ok) {

        throw new Error(
          `${currentConfig.dataFile}을 불러오지 못했습니다.`
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

        // ------------------------------------------------------
        // 지역별 유입·유출 통근·통학 인구 계산
        //
        // C1_NM = 출발지
        // C2_NM = 도착지
        // ------------------------------------------------------

        inflowByRegion = {};
        outflowByRegion = {};


        flows.forEach(flow => {

          const origin =
            flow.C1_NM;

          const destination =
            flow.C2_NM;

          const value =
            Number(flow.DT);


          // 유입
          if (!inflowByRegion[destination]) {

            inflowByRegion[destination] = 0;

          }

          inflowByRegion[destination] += value;


          // 유출
          if (!outflowByRegion[origin]) {

            outflowByRegion[origin] = 0;

          }

          outflowByRegion[origin] += value;

        });


        console.log(
          "지역별 유입인구:",
          inflowByRegion
        );


        console.log(
          "지역별 유출인구:",
          outflowByRegion
        );


      console.log(
        "지도용 OD 데이터:",
        flows
      );



      flows.sort(
        (a, b) =>
          Number(b.DT) -
          Number(a.DT)
      );

      // ------------------------------------------------------
      // OD별 곡선 + 애니메이션
      // ------------------------------------------------------

      flows.forEach((flow, rank) => {


        const origin =
          centers[flow.C1_NM];


        const destination =
          centers[flow.C2_NM];


        const value =
          Number(flow.DT);

        const flowStyle =
          getFlowStyle(
            rank,
            flows.length
          );

        // ----------------------------------------------------
        // 곡선 생성
        // ----------------------------------------------------

        const curvePoints =
          createCurvePoints(
            origin,
            destination,
            0.38,
            160
          );


        // ----------------------------------------------------
        // 희미한 전체 이동 경로
        // ----------------------------------------------------

        const line =
          L.polyline(
            curvePoints,
            {
              color: flowStyle.color,
              weight: 1,
              opacity: 0.06
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
        // 흐르는 화살표 애니메이션
        // ----------------------------------------------------

        const duration =
          getAnimationDuration(value);


        animateFlowArrow(
          curvePoints,
          duration,
          flowStyle,
          rank * 500
        );
      });


      // ------------------------------------------------------
      // 지역 대표점
      // ------------------------------------------------------

      // Object.entries(
      //   centers
      // ).forEach(
      //   ([name, coords]) => {

      //     L.circleMarker(
      //       coords,
      //       {
      //         radius: 5,

      //         color: "#35657f",

      //         fillColor: "#ffffff",
      //         fillOpacity: 1,

      //         weight: 2
      //       }
      //     )

      //       .addTo(map)

      //       .bindTooltip(
      //         name,
      //         {
      //           direction: "top"
      //         }
      //       );

      //   }
      // );

    })

    .catch(error => {

      console.error(
        "KOSIS 데이터 로딩 오류:",
        error
      );

    });

}

function getFlowStyle(rank, total) {

  const percentile =
    (rank / total) * 100;

  if (percentile < 20) {
    return {
      color: "#9E3D63",
      arrowSize: 17,
      lineWeight: 4.8
    };
  }

  if (percentile < 40) {
    return {
      color: "#B95B7B",
      arrowSize: 15,
      lineWeight: 4.1
    };
  }

  if (percentile < 60) {
    return {
      color: "#D17A97",
      arrowSize: 13,
      lineWeight: 3.5
    };
  }

  if (percentile < 80) {
    return {
      color: "#E3A0B5",
      arrowSize: 11,
      lineWeight: 3
    };
  }

  return {
    color: "#F0C6D2",
    arrowSize: 9,
    lineWeight: 2.5
  };
}

// ============================================================
// 11. 이동량 순위 범례
// ============================================================

const legend = L.control({
  position: "bottomleft"
});

legend.onAdd = function () {

  const div =
    L.DomUtil.create(
      "div",
      "flow-legend"
    );

  div.innerHTML = `
    <div class="legend-title">
      통근·통학 이동량 순위
    </div>

    <div class="legend-item">
      <span
        class="legend-color"
        style="background:#8F2746;">
      </span>
      상위 0~20%
    </div>

    <div class="legend-item">
      <span
        class="legend-color"
        style="background:#B8405E;">
      </span>
      상위 20~40%
    </div>

    <div class="legend-item">
      <span
        class="legend-color"
        style="background:#D9657C;">
      </span>
      상위 40~60%
    </div>

    <div class="legend-item">
      <span
        class="legend-color"
        style="background:#EA91A4;">
      </span>
      상위 60~80%
    </div>

    <div class="legend-item">
      <span
        class="legend-color"
        style="background:#F3BBC7;">
      </span>
      상위 80~100%
    </div>
  `;

  return div;
};

legend.addTo(map);