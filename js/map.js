
// ============================================================
// 1. 지도 생성 및 배경지도
// ============================================================

const map = L.map("map", {
  zoomControl: true,
  attributionControl: true
});

map.setView([37.45, 126.95], 8);

// CARTO Positron: neutral light tiles keep labels readable without sepia filters.
// Tile colors are provider-defined; CSS background is an approximation during loading.
L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    opacity: 0.85,
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
  },
  jeonbuk: {
    label: "전북",
    regions: ["전라북도"],
    centers: {
      "전라북도": [35.7175, 127.1530]
    },
    dataFile: "./data/jeonbuk_2020.json"
  },
  jeju: {
    label: "제주",
    regions: ["제주특별자치도"],
    centers: {
      "제주특별자치도": [33.4996, 126.5312]
    },
    dataFile: "./data/jeju_2020.json"
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
      
      // 단일 시도 권역: 지역 내부 / 기타 이동 인구
      const singleRegionCodes = {
        gangwon: "32",
        jeonbuk: "35",
        jeju: "39"
      };

      const regionCode = Object.entries(regionConfigs)
        .find(([, value]) => value === config)?.[0];

      if (singleRegionCodes[regionCode]) {

        const code = singleRegionCodes[regionCode];

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

        const total = findValue(code, "00");
        const within = findValue(code, code);

        if (
          total === null ||
          within === null ||
          total <= 0 ||
          within < 0 ||
          within > total
        ) {
          console.warn(`${config.label} 통계 확인 필요`, {
            total,
            within
          });
          return;
        }

        // 원자료에 별도의 '기타' 행이 있는 경우에만 해당 값 사용.
        const otherRow = data.find(d =>
          d.ITM_ID === "T1" &&
          String(d.C1) === code &&
          String(d.C2) === "90"
        );
        const other = otherRow && Number.isFinite(Number(otherRow.DT))
          ? Number(otherRow.DT)
          : null;
        const outside = total - within;
        const regionName = config.regions[0];

        regionStatsByName[regionName] = {
          type: "summary",
          total,
          within,
          outside,
          other,
          otherVerified: other !== null && other === outside,
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
  renderRegionOverview();
}

loadAllRegionStats().catch(error => {
  console.error("전체 권역 통계 로딩 오류:", error);
});

// 일반 권역: 실제로 지도에 그리는 시·도 간 OD 데이터만 사용합니다.
function renderFlowOverview(flows) {
  const panel = document.getElementById("regionOverview");
  if (!panel) return;
  panel.hidden = false;
  const fmt = value => Math.round(value).toLocaleString("ko-KR") + "명";
  const total = flows.reduce((sum, flow) => sum + Number(flow.DT), 0);
  const topFlows = flows.slice(0, 3);
  const topValue = topFlows.length ? Number(topFlows[0].DT) : 0;
  const regionRows = currentConfig.regions.map(name => {
    const inbound = inflowByRegion[name] || 0;
    const outbound = outflowByRegion[name] || 0;
    return { name, inbound, outbound, net: inbound - outbound };
  });
  const maxRegionFlow = Math.max(1, ...regionRows.flatMap(row => [row.inbound, row.outbound]));
  panel.innerHTML = `
    <div class="overview-eyebrow">01 / REGIONAL MOBILITY <span>2020</span></div>
    <div class="overview-heading">${currentConfig.label} 이동 분석</div>
    <div class="overview-subtitle">12세 이상 · 권역 내 서로 다른 시·도 간 이동</div>
    <div class="stat-grid stat-grid--mobility">
      <div class="stat-block"><span>총 OD 이동량</span><strong>${fmt(total)}</strong></div>
      <div class="stat-block"><span>분석 이동 경로</span><strong>${flows.length.toLocaleString("ko-KR")}개</strong></div>
    </div>
    <div class="insights-section">
      <div class="insights-section-title"><span class="section-number">02</span> 이동량 TOP 3</div>
      ${topFlows.length ? topFlows.map((flow, i) => `
        <div class="top-flow-item">
          <div class="top-flow-head"><span><b>${i + 1}위</b> ${flow.C1_NM} → ${flow.C2_NM}</span><strong>${fmt(Number(flow.DT))}</strong></div>
          <div class="top-flow-track"><span style="width:${topValue ? Number(flow.DT) / topValue * 100 : 0}%; background:${getFlowStyle(i, flows.length).color}"></span></div>
        </div>
      `).join("") : '<p class="overview-loading">표시할 이동 경로가 없습니다.</p>'}
    </div>
    <div class="insights-section">
      <div class="insights-section-title"><span class="section-number">03</span> 지역별 유입·유출 비교</div>
      <div class="flow-comparison-key"><span><i class="comparison-dot inbound"></i>유입</span><span><i class="comparison-dot outbound"></i>유출</span></div>
      ${regionRows.map(row => `
        <div class="region-flow-row">
          <div class="region-flow-label"><strong>${row.name}</strong><span>순유입 ${row.net > 0 ? "+" : ""}${fmt(row.net)}</span></div>
          <div class="region-flow-bars">
            <div class="region-flow-bar"><span>유입</span><div><i class="inbound" style="width:${row.inbound / maxRegionFlow * 100}%"></i></div><b>${fmt(row.inbound)}</b></div>
            <div class="region-flow-bar"><span>유출</span><div><i class="outbound" style="width:${row.outbound / maxRegionFlow * 100}%"></i></div><b>${fmt(row.outbound)}</b></div>
          </div>
        </div>
      `).join("")}
    </div>
    <div class="overview-note">지도에 표시된 권역 내 시·도 간 이동만 집계한 값입니다. 동일 시·도 내부 이동과 다른 권역으로의 이동은 포함하지 않습니다.<br>순유입 = 권역 내 유입 − 권역 내 유출 (거주지 이동 통계가 아님)</div>
  `;
}

// 단일 시·도 권역: 별도 In/Out 수치를 만들지 않고 원자료 집계를 표시합니다.
function renderRegionOverview() {
  const panel = document.getElementById("regionOverview");
  if (!panel) return;
  const isSingle = ["gangwon", "jeonbuk", "jeju"].includes(currentRegionKey);
  if (!isSingle) {
    panel.hidden = false;
    panel.innerHTML = `<div class="overview-eyebrow">01 / REGIONAL MOBILITY <span>2020</span></div><div class="overview-heading">${currentConfig.label} 이동 분석</div><p class="overview-loading">권역 내 OD 통계를 불러오는 중입니다.</p>`;
    return;
  }
  const stats = regionStatsByName[currentConfig.regions[0]];
  panel.hidden = false;
  if (!stats || stats.type !== "summary") {
    panel.innerHTML = `<p class="overview-loading">통계 자료를 확인할 수 없습니다.</p>`;
    return;
  }
  const format = value => value.toLocaleString("ko-KR") + "명";
  const otherText = stats.otherVerified ? format(stats.other) : "별도 집계 없음";
  const otherNote = stats.otherVerified
    ? `전체와 관내의 차이 ${format(stats.outside)}`
    : `전체와 관내 집계의 차이 0명 · 기타 이동 여부 판단 불가`;
  panel.innerHTML = `
    <div class="overview-eyebrow">01 / REGIONAL PROFILE <span>2020</span></div>
    <div class="overview-heading">${currentConfig.label} 통근·통학 현황</div>
    <div class="overview-subtitle">12세 이상 · 현 거주지 기준</div>
    <div class="stat-grid stat-grid--single">
      <div class="stat-block"><span>전체 통근·통학</span><strong>${format(stats.total)}</strong></div>
      <div class="stat-block"><span>관내 통근·통학</span><strong>${format(stats.within)}</strong></div>
    </div>
    <div class="ratio-label"><span>관내 비중</span><strong>${stats.withinPercent.toFixed(2)}%</strong></div>
    <div class="ratio-track" role="img" aria-label="관내 통근·통학 ${stats.withinPercent.toFixed(2)}퍼센트">
      <span class="ratio-within" style="width:${stats.withinPercent.toFixed(2)}%"></span>
    </div>
    <div class="ratio-key"><span><i class="key-dot within"></i>관내 ${format(stats.within)}</span><span><i class="key-dot other"></i>기타 ${otherText}</span></div>
    <div class="overview-note">${otherNote}<br>정확한 외부 유입·유출 OD 자료는 제공되지 않습니다.</div>
  `;
}


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
  // 대략 일정한 이동 템포, 큰 이동량도 과도하게 빨라지지 않음
  if (value >= 1000000) return 6500;
  if (value >= 500000) return 6800;
  if (value >= 150000) return 7100;
  return 7400;
}


// ============================================================
// 8. Data Stream - 얇은 곡선과 이동 파티클 (공유 Canvas)
// 실제 출발지/도착지의 곡선만 사용하며, 가상 이동 경로를 만들지 않습니다.
// ============================================================

const flowAnimations = [];
const flowCanvas = L.DomUtil.create("canvas", "flow-canvas");
Object.assign(flowCanvas.style, {
  position: "absolute", left: "0", top: "0", zIndex: "450",
  pointerEvents: "none"
});
map.getContainer().appendChild(flowCanvas);
const flowContext = flowCanvas.getContext("2d");
let flowPixelRatio = 1;
let flowAnimationStarted = false;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function resizeFlowCanvas() {
  const size = map.getSize();
  flowPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  flowCanvas.width = Math.round(size.x * flowPixelRatio);
  flowCanvas.height = Math.round(size.y * flowPixelRatio);
  flowCanvas.style.width = `${size.x}px`;
  flowCanvas.style.height = `${size.y}px`;
  flowContext.setTransform(flowPixelRatio, 0, 0, flowPixelRatio, 0, 0);
}
resizeFlowCanvas();
map.on("resize", resizeFlowCanvas);

function animateFlowArrow(points, duration, style, delay = 0) {
  flowAnimations.push({ points, duration, style, delay });
  if (!flowAnimationStarted) {
    flowAnimationStarted = true;
    requestAnimationFrame(renderFlowAnimations);
  }
}

function sampleFlowPoint(points, progress) {
  const index = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const i = Math.floor(index);
  const next = Math.min(i + 1, points.length - 1);
  const t = index - i;
  return {
    x: points[i].x + (points[next].x - points[i].x) * t,
    y: points[i].y + (points[next].y - points[i].y) * t
  };
}

function drawFlowPath(points, style) {
  const ctx = flowContext;
  const last = points.length - 1;
  if (!last) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = style.lineWeight;
  ctx.strokeStyle = style.color;
  ctx.globalAlpha = style.opacity;
  ctx.beginPath();
  points.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawFlowParticles(points, progress, style) {
  const ctx = flowContext;
  for (let i = 0; i < style.particleCount; i++) {
    const t = (progress + i / style.particleCount) % 1;
    const point = sampleFlowPoint(points, t);
    // 도착 지점은 부드럽게 사라지며 출발점에서 다시 나타납니다.
    const fadeIn = Math.min(1, t / 0.10);
    const fadeOut = Math.min(1, (1 - t) / 0.14);
    const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha * (0.58 + style.opacity * 0.35);
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, style.particleSize, 0, Math.PI * 2);
    ctx.fill();
    // 파티클 바로 뒤의 작은 잔상은 진행 방향을 알려줍니다.
    const prev = sampleFlowPoint(points, Math.max(0, t - 0.012));
    ctx.globalAlpha = alpha * 0.18;
    ctx.lineWidth = Math.max(1, style.lineWeight);
    ctx.strokeStyle = style.color;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.restore();
  }
}

function renderFlowAnimations(timestamp) {
  const ctx = flowContext;
  ctx.clearRect(0, 0, flowCanvas.width / flowPixelRatio,
    flowCanvas.height / flowPixelRatio);
  // 지도 이동/확대 시에도 Canvas 좌표를 Leaflet 컨테이너와 동기화합니다.
  for (const flow of flowAnimations) {
    const projected = flow.points.map(p => map.latLngToContainerPoint(p));
    drawFlowPath(projected, flow.style);
    if (!reduceMotion) {
      const progress = ((timestamp + flow.delay) % flow.duration) / flow.duration;
      drawFlowParticles(projected, progress, flow.style);
    }
  }
  if (!reduceMotion) requestAnimationFrame(renderFlowAnimations);
  else flowAnimationStarted = false;
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
        color: selected ? "#4779FA" : "#DCE6EF",
        weight: selected ? 1.7 : 0.9,
        fillColor: selected ? "#E5E9FF" : "#F7FAFC",
        fillOpacity: selected ? 0.46 : 0.30
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
          if (!stats) return `<div class="region-tooltip-name">${name}</div>`;
          if (stats.type === "summary") {
            const otherLine = stats.otherVerified
              ? `${stats.other.toLocaleString()}명`
              : "별도 집계 미확인";
            return `
              <div class="region-tooltip-name">${name}</div>
              <div class="tooltip-subtitle">2020 · 12세 이상 통근·통학 인구</div>
              <div class="tooltip-metric"><span>전체</span><strong>${stats.total.toLocaleString()}명</strong></div>
              <div class="tooltip-metric"><span>관내</span><strong>${stats.within.toLocaleString()}명</strong></div>
              <div class="tooltip-metric"><span>기타 통근·통학지</span><strong>${otherLine}</strong></div>
              <div class="tooltip-note">관내 비중 ${stats.withinPercent.toFixed(2)}% · 구체적 OD 경로 미제공</div>
            `;
          }
          return `
            <div class="region-tooltip-name">${name}</div>
            <div class="tooltip-subtitle">권역 내 시·도 간 이동 · 2020</div>
            <div class="tooltip-metric"><span>유입</span><strong>${stats.inflow.toLocaleString()}명</strong></div>
            <div class="tooltip-metric"><span>유출</span><strong>${stats.outflow.toLocaleString()}명</strong></div>
          `;
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
          fillColor: selected ? "#AFC4E9" : "#E5E9FF",
          fillOpacity: selected ? 0.64 : 0.48,
          color: selected ? "#4779FA" : "#A3B9D8",
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

    if (selectedFeatures.length) {
      map.fitBounds(selectedLayer.getBounds(), {
        padding: [90, 90], maxZoom: 7, animate: true, duration: 0.45
      });
    } else {
      console.warn("선택한 권역의 GeoJSON 지명을 찾지 못했습니다:", selectedRegions);
    }

    loadCommuteFlows();
  })

  .catch(error => {
    console.error("GeoJSON 로딩 오류:", error);
  });


// ============================================================
// 10. KOSIS OD 데이터 불러오기
// ============================================================

function loadCommuteFlows() {
  if (["gangwon", "jeonbuk", "jeju"].includes(currentRegionKey)) return;
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

      // 지도 이동선과 완전히 동일한 OD 자료로 통계 카드를 생성합니다.
      renderFlowOverview(flows);

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

        // 팝업 상호작용을 위한 투명 경로(경로 본체는 Canvas에서 표시)
        const line = L.polyline(
          curvePoints,
          {
            color: flowStyle.color,
            weight: 10,
            opacity: 0.005
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

        // 얇은 경로 + 데이터 스트림 파티클 애니메이션
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
      const panel = document.getElementById("regionOverview");
      if (panel) {
        panel.hidden = false;
        panel.innerHTML = `<div class="overview-heading">${currentConfig.label} 이동 분석</div><p class="overview-loading">OD 데이터를 불러오지 못했습니다.</p>`;
      }
    });
}


// ============================================================
// 11. 이동량에 따른 화살표 색상 및 크기
// ============================================================

function getFlowStyle(rank, total) {
  const percentile = total > 0 ? (rank / total) * 100 : 100;

  if (percentile < 20) return {
    color: "#F0448C", lineWeight: 2.0, opacity: 0.72,
    particleSize: 3.6, particleCount: 5
  };
  if (percentile < 40) return {
    color: "#D34FE5", lineWeight: 1.7, opacity: 0.65,
    particleSize: 3.1, particleCount: 4
  };
  if (percentile < 60) return {
    color: "#925BFA", lineWeight: 1.5, opacity: 0.57,
    particleSize: 2.8, particleCount: 3
  };
  if (percentile < 80) return {
    color: "#4779FA", lineWeight: 1.3, opacity: 0.48,
    particleSize: 2.5, particleCount: 3
  };
  return {
    color: "#16B8D4", lineWeight: 1.1, opacity: 0.38,
    particleSize: 2.2, particleCount: 2
  };
}

// ============================================================
// 12. 실제 데이터 표현 방식에 맞춘 권역별 범례
// ============================================================
const legend = L.control({ position: "bottomleft" });
legend.onAdd = function () {
  const div = L.DomUtil.create("div", "flow-legend");
  if (["gangwon", "jeonbuk", "jeju"].includes(currentRegionKey)) {
    div.innerHTML = `
      <div class="legend-eyebrow">DATA GUIDE</div>
      <div class="legend-title">${currentConfig.label} · 통근·통학 구성</div>
      <div class="legend-item"><span class="legend-color" style="background:#925BFA"></span>관내 통근·통학</div>
      <div class="legend-item"><span class="legend-color" style="background:#16B8D4"></span>기타 통근·통학지 (자료 존재 시)</div>

      <p class="legend-description">화살표 없음 · 세부 이동 경로 미제공<br>숫자와 구성비는 우측 통계 카드에서 확인</p>
    `;
  } else {
    const tiers = [
      ["#F0448C", "상위 0–20%", "2px", "5px"],
      ["#D34FE5", "상위 20–40%", "1.7px", "4.5px"],
      ["#925BFA", "상위 40–60%", "1.5px", "4px"],
      ["#4779FA", "상위 60–80%", "1.3px", "3.5px"],
      ["#16B8D4", "상위 80–100%", "1.1px", "3px"]
    ];
    div.innerHTML = `
      <div class="legend-eyebrow">FLOW INTENSITY</div>
      <div class="legend-title">권역 내 이동량 순위</div>
      ${tiers.map(([color,label,weight,dot]) => `
        <div class="legend-item">
          <span class="flow-line-demo" style="--flow-color:${color};--flow-weight:${weight};--dot-size:${dot}"><i></i></span>
          ${label}
        </div>
      `).join("")}
      <p class="legend-description">곡선은 실제 경로가 아닌 지역 간 이동 관계입니다.</p>
    `;
  }
  return div;
};
legend.addTo(map);
