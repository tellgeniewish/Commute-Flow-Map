
// ============================================================
// 1. 지도 생성 및 배경지도
// ============================================================

const map = L.map("map", {
  zoomControl: true,
  attributionControl: true
});

map.setView([37.45, 126.95], 8);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 18,
    opacity: 0.35,
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);


// ============================================================
// 2. 권역별 설정
// ============================================================

const regionConfigs = {
  capital: {
    label: "서울·인천·경기",
    regions: ["서울특별시", "인천광역시", "경기도"],
    centers: {
      "서울특별시": [37.5665, 126.9780],
      "인천광역시": [37.4563, 126.7052],
      "경기도": [37.2750, 127.0095]
    },
    dataFile: "./data/capital_2020.json"
  },

  southeast: {
    label: "부산·울산·경남",
    regions: ["부산광역시", "울산광역시", "경상남도"],
    centers: {
      "부산광역시": [35.1796, 129.0756],
      "울산광역시": [35.5384, 129.3114],
      "경상남도": [35.2383, 128.6924]
    },
    dataFile: "./data/busan_ulsan_gyeongnam_2020.json"
  },

  daegu_gyeongbuk: {
    label: "대구·경북",
    regions: ["대구광역시", "경상북도"],
    centers: {
      "대구광역시": [35.8714, 128.6014],
      "경상북도": [36.5760, 128.5056]
    },
    dataFile: "./data/daegu_gyeongbuk_2020.json"
  },

  gwangju_jeonnam: {
    label: "광주·전남",
    regions: ["광주광역시", "전라남도"],
    centers: {
      "광주광역시": [35.1595, 126.8526],
      "전라남도": [34.8679, 126.9910]
    },
    dataFile: "./data/gwangju_jeonnam_2020.json"
  },

  chungcheong: {
    label: "대전·세종·충북·충남",
    regions: [
      "대전광역시",
      "세종특별자치시",
      "충청북도",
      "충청남도"
    ],
    centers: {
      "대전광역시": [36.3504, 127.3845],
      "세종특별자치시": [36.4800, 127.2890],
      "충청북도": [36.6357, 127.4917],
      "충청남도": [36.6588, 126.6728]
    },
    dataFile: "./data/daejeon_sejong_chungcheong_2020.json"
  },
  gangwon: {
    label: "강원",
    regions: ["강원특별자치도"],
    centers: {
      "강원특별자치도": [37.8228, 128.1555]
    },
    dataFile: "./data/gangwon_2020.json"
  }
};


// ============================================================
// 3. 현재 권역 및 지역별 통계
// ============================================================

const urlParams = new URLSearchParams(window.location.search);
const requestedRegion = urlParams.get("region");

const currentRegionKey = regionConfigs[requestedRegion]
  ? requestedRegion
  : "capital";

const currentConfig = regionConfigs[currentRegionKey];
const selectedRegions = currentConfig.regions;
const centers = currentConfig.centers;

let inflowByRegion = {};
let outflowByRegion = {};
let regionStatsByName = {};


// ============================================================
// 4. 전체 권역 호버 통계 불러오기
// ============================================================

async function loadAllRegionStats() {
  regionStatsByName = {};

  const configs = Object.values(regionConfigs);

  await Promise.all(
    configs.map(async config => {
      const response = await fetch(config.dataFile);

      if (!response.ok) {
        throw new Error(
          `${config.dataFile}을 불러오지 못했습니다.`
        );
      }
      
      const data = await response.json();
      const regionSet = new Set(config.regions);

      // 강원은 광역단위 OD가 아닌 지역 내·기타 구성비로 처리
      if (config === regionConfigs.gangwon) {
        const findValue = (origin, destination) => {
          const row = data.find(d =>
            d.ITM_ID === "T1" &&
            String(d.C1) === origin &&
            String(d.C2) === destination
          );

          if (!row) return null;

          const value = Number(row.DT);
          return Number.isFinite(value) ? value : null;
        };

        const total = findValue("32", "00");
        const within = findValue("32", "32");

        if (total === null || within === null || within > total) {
          console.warn("강원 통계 필수 항목 확인 필요", {
            total,
            within
          });
          return;
        }

        const outside = total - within;

        regionStatsByName["강원특별자치도"] = {
          type: "summary",
          total,
          within,
          outside,
          withinPercent: (within / total) * 100,
          outsidePercent: (outside / total) * 100
        };

        return;
      }

      const flows = data.filter(d =>
        d.ITM_ID === "T1" &&
        d.C1_NM !== "계" &&
        d.C2_NM !== "계" &&
        d.C1_NM !== "기타" &&
        d.C2_NM !== "기타" &&
        d.C1_NM !== d.C2_NM &&
        regionSet.has(d.C1_NM) &&
        regionSet.has(d.C2_NM)
      );

      config.regions.forEach(regionName => {
        regionStatsByName[regionName] = {
          inflow: 0,
          outflow: 0
        };
      });

      flows.forEach(flow => {
        const origin = flow.C1_NM;
        const destination = flow.C2_NM;
        const value = Number(flow.DT);

        regionStatsByName[destination].inflow += value;
        regionStatsByName[origin].outflow += value;
      });
    })
  );

  console.log("전체 권역 호버 통계:", regionStatsByName);
}

loadAllRegionStats().catch(error => {
  console.error("전체 권역 통계 로딩 오류:", error);
});


// ============================================================
// 5. 권역 선택 드롭다운
// ============================================================

const regionSelect = document.getElementById("regionSelect");

if (regionSelect) {
  regionSelect.value = currentRegionKey;

  regionSelect.addEventListener("change", event => {
    const regionKey = event.target.value;
    window.location.search = `?region=${regionKey}`;
  });
}


// ============================================================
// 6. 곡선 이동 경로 생성 - Quadratic Bezier
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

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const distance = Math.hypot(dLat, dLng) || 1;

  const rightLat = dLng / distance;
  const rightLng = -dLat / distance;

  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;

  const controlLat =
    midLat + rightLat * distance * bend;

  const controlLng =
    midLng + rightLng * distance * bend;

  const points = [];

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
// 7. 이동량별 애니메이션 속도
// ============================================================

function getAnimationDuration(value) {
  if (value >= 1000000) return 4200;
  if (value >= 500000) return 4800;
  if (value >= 150000) return 5400;
  return 6200;
}


// ============================================================
// 8. 부드러운 화살표 애니메이션 - 공유 Canvas
//
// 변경 핵심:
// 1) 모든 OD가 하나의 Canvas를 공유
// 2) requestAnimationFrame 하나로 통합
// 3) 소수점 좌표까지 연속 보간
// 4) 곡선의 접선 방향에 맞게 화살촉 회전
// 5) 시작/종료 구간에서 자연스럽게 페이드
// ============================================================

const flowAnimations = [];

const flowCanvas = L.DomUtil.create(
  "canvas",
  "flow-canvas"
);

flowCanvas.style.position = "absolute";
flowCanvas.style.left = "0";
flowCanvas.style.top = "0";
flowCanvas.style.zIndex = "450";
flowCanvas.style.pointerEvents = "none";

map.getContainer().appendChild(flowCanvas);

const flowContext = flowCanvas.getContext("2d");

let flowPixelRatio = 1;
let flowAnimationStarted = false;


// ------------------------------------------------------------
// Canvas 크기 설정
// ------------------------------------------------------------

function resizeFlowCanvas() {
  const size = map.getSize();

  flowPixelRatio = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  flowCanvas.width = Math.round(size.x * flowPixelRatio);
  flowCanvas.height = Math.round(size.y * flowPixelRatio);

  flowCanvas.style.width = `${size.x}px`;
  flowCanvas.style.height = `${size.y}px`;

  flowContext.setTransform(
    flowPixelRatio,
    0,
    0,
    flowPixelRatio,
    0,
    0
  );
}

resizeFlowCanvas();
map.on("resize", resizeFlowCanvas);


// ------------------------------------------------------------
// 이동 경로 등록
// ------------------------------------------------------------

function animateFlowArrow(
  points,
  duration,
  style,
  delay = 0
) {
  flowAnimations.push({
    points,
    duration,
    style,
    delay
  });

  if (!flowAnimationStarted) {
    flowAnimationStarted = true;
    requestAnimationFrame(renderFlowAnimations);
  }
}


// ------------------------------------------------------------
// 이동 경로의 점 사이를 연속 보간
// ------------------------------------------------------------

function interpolateFlowPoint(points, index) {
  const boundedIndex = Math.max(
    0,
    Math.min(points.length - 1, index)
  );

  const i = Math.floor(boundedIndex);
  const next = Math.min(i + 1, points.length - 1);
  const fraction = boundedIndex - i;

  return {
    x:
      points[i].x +
      (points[next].x - points[i].x) * fraction,

    y:
      points[i].y +
      (points[next].y - points[i].y) * fraction
  };
}


// ------------------------------------------------------------
// 유선형 화살표 그리기
// ------------------------------------------------------------

function drawMovingFlowArrow(
  projectedPoints,
  progress,
  style
) {
  const last = projectedPoints.length - 1;

  if (last < 2) return;

  const headIndex = progress * last;
  const tailIndex = Math.max(
    0,
    headIndex - last * 0.28
  );

  const trailLength = headIndex - tailIndex;

  if (trailLength < 1.5) return;

  // 시작과 끝에서 투명도 조절
  const fadeIn = Math.min(1, progress / 0.10);
  const fadeOut = Math.min(1, (1 - progress) / 0.10);

  const opacity = Math.max(
    0,
    Math.min(fadeIn, fadeOut)
  );

  if (opacity <= 0) return;

  const leftSide = [];
  const rightSide = [];

  const sampleCount = Math.max(
    8,
    Math.ceil(trailLength)
  );

  for (let i = 0; i <= sampleCount; i++) {
    const fraction = i / sampleCount;

    const index =
      tailIndex + trailLength * fraction;

    const p = interpolateFlowPoint(
      projectedPoints,
      index
    );

    const before = interpolateFlowPoint(
      projectedPoints,
      Math.max(0, index - 0.35)
    );

    const after = interpolateFlowPoint(
      projectedPoints,
      Math.min(last, index + 0.35)
    );

    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;

    const nx = -dy / length;
    const ny = dx / length;

    // 꼬리에서 머리로 갈수록 폭이 증가
    const halfWidth =
      0.20 +
      style.lineWeight *
      0.46 *
      Math.pow(fraction, 1.4);

    leftSide.push({
      x: p.x + nx * halfWidth,
      y: p.y + ny * halfWidth
    });

    rightSide.push({
      x: p.x - nx * halfWidth,
      y: p.y - ny * halfWidth
    });
  }

  const head = interpolateFlowPoint(
    projectedPoints,
    headIndex
  );

  const previous = interpolateFlowPoint(
    projectedPoints,
    Math.max(0, headIndex - 0.8)
  );

  const next = interpolateFlowPoint(
    projectedPoints,
    Math.min(last, headIndex + 0.8)
  );

  const dx = next.x - previous.x;
  const dy = next.y - previous.y;

  const directionLength = Math.hypot(dx, dy) || 1;

  const ux = dx / directionLength;
  const uy = dy / directionLength;

  const nx = -uy;
  const ny = ux;

  // 곡선 접선 방향의 화살촉
  const arrowLength = style.arrowSize * 0.85;
  const arrowHalfWidth = style.arrowSize * 0.38;

  const tip = {
    x: head.x + ux * arrowLength,
    y: head.y + uy * arrowLength
  };

  const headLeft = {
    x: head.x + nx * arrowHalfWidth,
    y: head.y + ny * arrowHalfWidth
  };

  const headRight = {
    x: head.x - nx * arrowHalfWidth,
    y: head.y - ny * arrowHalfWidth
  };

  const ctx = flowContext;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();

  ctx.moveTo(
    leftSide[0].x,
    leftSide[0].y
  );

  for (let i = 1; i < leftSide.length; i++) {
    ctx.lineTo(
      leftSide[i].x,
      leftSide[i].y
    );
  }

  ctx.lineTo(headLeft.x, headLeft.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(headRight.x, headRight.y);

  for (let i = rightSide.length - 1; i >= 0; i--) {
    ctx.lineTo(
      rightSide[i].x,
      rightSide[i].y
    );
  }

  ctx.closePath();

  // 꼬리는 투명하고 머리 부분은 선명하게
  const tail = interpolateFlowPoint(
    projectedPoints,
    tailIndex
  );

  const gradient = ctx.createLinearGradient(
    tail.x,
    tail.y,
    tip.x,
    tip.y
  );

  gradient.addColorStop(
    0,
    hexToRgba(style.color, 0.00)
  );

  gradient.addColorStop(
    0.45,
    hexToRgba(style.color, 0.28)
  );

  gradient.addColorStop(
    1,
    hexToRgba(style.color, 0.80)
  );

  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}


// ------------------------------------------------------------
// 모든 화살표를 하나의 루프에서 렌더링
// ------------------------------------------------------------

function renderFlowAnimations(timestamp) {
  flowContext.clearRect(
    0,
    0,
    flowCanvas.width / flowPixelRatio,
    flowCanvas.height / flowPixelRatio
  );

  for (const flow of flowAnimations) {
    const projectedPoints = flow.points.map(
      p => map.latLngToContainerPoint(p)
    );

    // 동일 경로에 시간차를 둔 화살표 2개
    for (let copy = 0; copy < 2; copy++) {
      const offset =
        timestamp +
        flow.delay +
        copy * flow.duration / 2;

      const progress =
        (((offset % flow.duration) + flow.duration)
          % flow.duration) / flow.duration;

      drawMovingFlowArrow(
        projectedPoints,
        progress,
        flow.style
      );
    }
  }

  requestAnimationFrame(renderFlowAnimations);
}


// ------------------------------------------------------------
// HEX 색상 → RGBA
// ------------------------------------------------------------

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");

  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);

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
      const name = feature.properties.CTP_KOR_NM;
      const selected = selectedRegions.includes(name);

      return {
        color: selected ? "#8fb8bd" : "#cfcfcf",
        weight: selected ? 1.6 : 1,
        fillColor: selected ? "#c8eee6" : "#eeeeee",
        fillOpacity: 0.55
      };
    }

    // --------------------------------------------------------
    // 지역 호버와 클릭
    // --------------------------------------------------------

    function onEachRegion(feature, layer) {
      const name = feature.properties.CTP_KOR_NM;
      const selected = selectedRegions.includes(name);

      layer.bindTooltip(
        () => {
          const stats = regionStatsByName[name];

          
        if (stats) {
          // 강원: 전체 / 지역 내 / 기타 통근·통학 인구
          if (stats.type === "summary") {
            return `
              <div class="region-tooltip-name">
                ${name} 통근·통학 인구 (2020)
              </div>

              <div class="region-tooltip-label">
                전체
              </div>
              <div class="region-tooltip-value">
                ${stats.total.toLocaleString()}명
              </div>

              <div class="region-tooltip-label">
                강원 내부
              </div>
              <div class="region-tooltip-value">
                ${stats.within.toLocaleString()}명
                (${stats.withinPercent.toFixed(2)}%)
              </div>

              <div class="region-tooltip-label">
                기타 지역
              </div>
              <div class="region-tooltip-value">
                ${stats.outside.toLocaleString()}명
                (${stats.outsidePercent.toFixed(2)}%)
              </div>
            `;
          }
          // 기존 권역: 유입 / 유출
          return `
            <div class="region-tooltip-name">
              ${name} 권역 내 통근·통학 인구
            </div>

            <div class="region-tooltip-label">
              유입
            </div>
            <div class="region-tooltip-value">
              ${stats.inflow.toLocaleString()}명
            </div>

            <div class="region-tooltip-label">
              유출
            </div>
            <div class="region-tooltip-value">
              ${stats.outflow.toLocaleString()}명
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
      
      // 클릭한 지역이 속한 권역으로 자동 전환
      layer.on("click", function () {

        const targetKey = Object.keys(regionConfigs).find(
          key => regionConfigs[key].regions.includes(name)
        );

        if (
          targetKey &&
          targetKey !== currentRegionKey
        ) {
          window.location.search = `?region=${targetKey}`;
        }

      });

      layer.on("mouseover", function () {
        layer.setStyle({
          fillColor: selected ? "#9fd8cc" : "#dddddd",
          fillOpacity: selected ? 0.8 : 0.7,
          color: selected ? "#557d68" : "#999999",
          weight: 2
        });
      });

      layer.on("mouseout", function () {
        layer.setStyle(getRegionStyle(feature));
      });
    }

    // GeoJSON 추가
    L.geoJSON(geoData, {
      style: getRegionStyle,
      onEachFeature: onEachRegion
    }).addTo(map);

    // 현재 선택 권역으로 지도 이동
    const selectedFeatures = geoData.features.filter(
      feature =>
        selectedRegions.includes(
          feature.properties.CTP_KOR_NM
        )
    );

    const selectedLayer = L.geoJSON(selectedFeatures);

    map.fitBounds(
      selectedLayer.getBounds(),
      {
        padding: [90, 90],
        maxZoom: 7,
        animate: true,
        duration: 0.45
      }
    );

    loadCommuteFlows();
  })

  .catch(error => {
    console.error("GeoJSON 로딩 오류:", error);
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
      console.log("KOSIS 원본 데이터:", data);

      // T1 전체 통근·통학 인구
      // 계 / 기타 / 동일지역 이동 제외
      const flows = data.filter(d =>
        d.ITM_ID === "T1" &&
        d.C1_NM !== "계" &&
        d.C2_NM !== "계" &&
        d.C1_NM !== "기타" &&
        d.C2_NM !== "기타" &&
        d.C1_NM !== d.C2_NM &&
        centers[d.C1_NM] &&
        centers[d.C2_NM]
      );

      // 지역별 유입·유출 계산
      inflowByRegion = {};
      outflowByRegion = {};

      flows.forEach(flow => {
        const origin = flow.C1_NM;
        const destination = flow.C2_NM;
        const value = Number(flow.DT);

        if (!inflowByRegion[destination]) {
          inflowByRegion[destination] = 0;
        }

        inflowByRegion[destination] += value;

        if (!outflowByRegion[origin]) {
          outflowByRegion[origin] = 0;
        }

        outflowByRegion[origin] += value;
      });

      console.log("지역별 유입인구:", inflowByRegion);
      console.log("지역별 유출인구:", outflowByRegion);
      console.log("지도용 OD 데이터:", flows);

      // 이동량이 많은 순서대로 정렬
      flows.sort((a, b) =>
        Number(b.DT) - Number(a.DT)
      );

      // 각 OD별 경로와 화살표 생성
      flows.forEach((flow, rank) => {
        const origin = centers[flow.C1_NM];
        const destination = centers[flow.C2_NM];
        const value = Number(flow.DT);

        const flowStyle = getFlowStyle(
          rank,
          flows.length
        );

        const curvePoints = createCurvePoints(
          origin,
          destination,
          0.38,
          160
        );

        // 희미한 경로 선
        const line = L.polyline(
          curvePoints,
          {
            color: flowStyle.color,
            weight: 1,
            opacity: 0.06
          }
        ).addTo(map);

        // 클릭 팝업
        line.bindPopup(`
          <strong>
            ${flow.C1_NM} → ${flow.C2_NM}
          </strong>
          <br><br>
          통근·통학 인구:
          <strong>${value.toLocaleString()}명</strong>
        `);

        // 부드러운 화살표 애니메이션
        const duration = getAnimationDuration(value);

        animateFlowArrow(
          curvePoints,
          duration,
          flowStyle,
          rank * 500
        );
      });
    })

    .catch(error => {
      console.error("KOSIS 데이터 로딩 오류:", error);
    });
}


// ============================================================
// 11. 이동량에 따른 화살표 색상 및 크기
// ============================================================

function getFlowStyle(rank, total) {
  const percentile = (rank / total) * 100;

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
// 12. 이동량 순위 범례
// ============================================================

const legend = L.control({
  position: "bottomleft"
});

legend.onAdd = function () {
  const div = L.DomUtil.create(
    "div",
    "flow-legend"
  );

  // 강원: 이동량 순위 대신 통근·통학 구성비 안내
  if (currentRegionKey === "gangwon") {
    div.innerHTML = `
      <div class="legend-title">
        강원 통근·통학 인구
      </div>

      <div class="legend-item">
        <span class="legend-color"
          style="background:#568C83;">
        </span>
        강원 내부 이동
      </div>

      <div class="legend-item">
        <span class="legend-color"
          style="background:#D9A86C;">
        </span>
        기타 지역
      </div>

      <div style="
        margin-top:10px;
        font-size:12px;
        line-height:1.7;
      ">
        강원도에 마우스를 올리면<br>
        전체 인구와 구성비를 확인할 수 있습니다.
      </div>

      <div style="
        margin-top:6px;
        font-size:11px;
        opacity:0.7;
      ">
        기준: 2020년 · KOSIS
      </div>
    `;

    return div;
  }

  div.innerHTML = `
    <div class="legend-title">
      통근·통학 이동량 순위
    </div>

    <div class="legend-item">
      <span class="legend-color"
        style="background:#8F2746;">
      </span>
      상위 0~20%
    </div>

    <div class="legend-item">
      <span class="legend-color"
        style="background:#B8405E;">
      </span>
      상위 20~40%
    </div>

    <div class="legend-item">
      <span class="legend-color"
        style="background:#D9657C;">
      </span>
      상위 40~60%
    </div>

    <div class="legend-item">
      <span class="legend-color"
        style="background:#EA91A4;">
      </span>
      상위 60~80%
    </div>

    <div class="legend-item">
      <span class="legend-color"
        style="background:#F3BBC7;">
      </span>
      상위 80~100%
    </div>
  `;

  return div;
};

legend.addTo(map);
