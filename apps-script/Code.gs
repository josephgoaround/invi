/**
 * 강영석 ♥ 권지은 Wedding — Google Apps Script Backend
 * =====================================================
 * 배포 방법:
 *  1. https://script.google.com 에서 새 프로젝트 생성
 *  2. 이 코드를 붙여넣기
 *  3. 배포 > 새 배포 > 웹 앱
 *     - 실행 계정: 나(Me)
 *     - 액세스: 모든 사용자(Anyone)
 *  4. 배포 URL을 index.html 의 APPS_SCRIPT_URL 에 입력
 *
 * ▶ 시트 헤더 초기화 방법:
 *  Apps Script 편집기에서 setupAllSheets 함수를 선택 후 ▶ 실행
 *  → 3개 시트의 헤더가 모두 올바른 순서로 자동 설정됩니다.
 */

// ── 시트 헤더 일괄 초기화 (편집기에서 수동 실행) ──────
// Apps Script 편집기 상단 함수 선택창에서 'setupAllSheets' 선택 후 ▶ 실행
function setupAllSheets() {
  // 1. RSVP 시트
  var rsvpSheet  = SpreadsheetApp.openById(RSVP_SHEET_ID).getSheets()[0];
  var rsvpHeader = ['타임스탬프', '성함', '관계', '연락처', '참석여부', '인원수', '메시지', 'Remark'];
  applyHeader(rsvpSheet, rsvpHeader);

  // 2. 축하 메시지 시트
  var cmtSheet  = SpreadsheetApp.openById(COMMENT_SHEET_ID).getSheets()[0];
  var cmtHeader = ['ID', '타임스탬프', '성함', '메시지'];
  applyHeader(cmtSheet, cmtHeader);

  // 3. 스냅 제출 명단 시트
  var snapSheet  = SpreadsheetApp.openById(SNAP_SHEET_ID).getSheets()[0];
  var snapHeader = ['타임스탬프', '성함', '연락처', '파일 수', '저장 파일명'];
  applyHeader(snapSheet, snapHeader);

  Logger.log('✅ 모든 시트 헤더 설정 완료');
}

// 헤더를 강제로 1행에 덮어쓰는 내부 함수 (setupAllSheets 전용)
function applyHeader(sheet, header) {
  // 1행이 없으면 빈 행 추가
  if (sheet.getLastRow() === 0) sheet.appendRow(header);

  // 1행 전체를 헤더로 덮어쓰기
  var range = sheet.getRange(1, 1, 1, header.length);
  range.setValues([header]);
  range.setFontWeight('bold').setBackground('#F7F4EE');
  sheet.setFrozenRows(1);

  // 헤더보다 넓은 기존 컬럼이 있으면 초과분 클리어
  var lastCol = sheet.getLastColumn();
  if (lastCol > header.length) {
    sheet.getRange(1, header.length + 1, 1, lastCol - header.length).clearContent();
  }
}

// ── 설정값 ────────────────────────────────────────────
const RSVP_SHEET_ID    = '1jcLL_HM00aGnfyOL1FxdXTy31dae5ezOxqxEg3FV7_U'; // 본식 RSVP
const COMMENT_SHEET_ID = '1jTZjlu9QQq69lSIV9TcgAU9q2yTUghnT3liXW9NS0LE'; // 축하 메시지
const SNAP_SHEET_ID    = '1JpCAUW23zn1a_ZNiJrENMMtrHIhmt9tepHxJRc9jhAY'; // 스냅 제출 명단
const DRIVE_FOLDER_ID  = '1pkuh2kDPZWCKxT62I_i5EXuzyURt4k3g';             // 하객 스냅 사진 폴더
const GALLERY_FOLDER_ID = '1iWRsz2wizN_6Ofe_Lh4ROuKrrUoTh4n8';            // 갤러리 (우리의 이야기)
// ─────────────────────────────────────────────────────

// ── GET: ?action=gallery → 갤러리 이미지 ID 목록 반환 ──
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;

  if (action === 'gallery') {
    try {
      var folder = DriveApp.getFolderById(GALLERY_FOLDER_ID);
      var files  = folder.getFiles();
      var images = [];
      var imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      while (files.hasNext()) {
        var f = files.next();
        if (imageTypes.indexOf(f.getMimeType()) !== -1) {
          images.push({ id: f.getId(), name: f.getName() });
        }
      }
      // 파일명 기준 정렬
      images.sort(function(a, b) { return a.name.localeCompare(b.name); });
      var output = ContentService
        .createTextOutput(JSON.stringify({ ok: true, images: images }))
        .setMimeType(ContentService.MimeType.JSON);
      return output;
    } catch(err) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 기본 응답
  return ContentService
    .createTextOutput('Wedding API is running ✦')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if      (data.type === 'rsvp')    handleRsvp(data);
    else if (data.type === 'snap')    handleSnap(data);
    else if (data.type === 'comment') handleComment(data);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 헤더 보장 함수 ────────────────────────────────────
// 시트가 비어있으면 헤더를 새로 추가하고,
// 기존 헤더가 다르면 자동으로 교정합니다.
function ensureHeader(sheet, header) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground('#F7F4EE');
    sheet.setFrozenRows(1);
    return;
  }

  // 기존 헤더와 비교
  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), header.length))
                        .getValues()[0]
                        .slice(0, header.length);
  const needsUpdate = header.some(function(col, i) { return existing[i] !== col; });

  if (needsUpdate) {
    const range = sheet.getRange(1, 1, 1, header.length);
    range.setValues([header]);
    range.setFontWeight('bold').setBackground('#F7F4EE');
    sheet.setFrozenRows(1);
  }
}

// ── RSVP → 본식 RSVP 시트 기록 (upsert: 성함+연락처 동일 시 최신 내용으로 수정) ──
// 컬럼 순서: 타임스탬프 | 성함 | 관계 | 연락처 | 참석여부 | 인원수 | 메시지 | Remark
function handleRsvp(data) {
  const sheet  = SpreadsheetApp.openById(RSVP_SHEET_ID).getSheets()[0];
  const HEADER = ['타임스탬프', '성함', '관계', '연락처', '참석여부', '인원수', '메시지', 'Remark'];

  ensureHeader(sheet, HEADER);

  const newAttend  = data.attending === 'yes' ? '✓ 참석' : '✕ 불참';
  const newTs      = Utilities.formatDate(new Date(data.timestamp), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  const lastRow    = sheet.getLastRow();

  // 성함 + 연락처가 동일한 기존 행 탐색 (헤더 제외, 역순으로 최근 행 우선)
  if (lastRow > 1) {
    const allValues = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    for (var i = allValues.length - 1; i >= 0; i--) {
      var row = allValues[i];
      if (row[1] === data.name && row[3] === data.contact) {
        // 기존 행 발견 → 업데이트
        var existingAttend  = row[4];   // 기존 참석여부
        var existingRemark  = row[7] ? String(row[7]) : '';

        // 변경횟수 파싱
        var changeCount = 0;
        var cntMatch = existingRemark.match(/변경횟수 (\d+)회/);
        if (cntMatch) changeCount = parseInt(cntMatch[1]);
        changeCount++;

        // Remark 생성: "이전에 '참석'으로 답변 → 변경 (변경횟수 n회)"
        var prevLabel = existingAttend === '✓ 참석' ? '참석' : '불참';
        var newRemark = '\'' + prevLabel + '\'에서 변경 (변경횟수 ' + changeCount + '회)';
        // 기존 로그가 있으면 누적
        if (existingRemark) {
          // 이전 remark에서 "(변경횟수 n회)" 패턴 제거 후 앞쪽에 신규 항목 추가
          newRemark = newRemark + ' | ' + existingRemark.replace(/ \(변경횟수 \d+회\)/, '');
        }

        var targetRow = i + 2; // 시트는 1-indexed, 헤더 행 포함
        sheet.getRange(targetRow, 1, 1, 8).setValues([[
          newTs,
          data.name,
          data.relation  || '',
          data.contact,
          newAttend,
          data.partySize || '-',
          data.message   || '',
          newRemark
        ]]);
        return;
      }
    }
  }

  // 신규 제출: 행 추가
  sheet.appendRow([
    newTs,
    data.name,
    data.relation  || '',
    data.contact,
    newAttend,
    data.partySize || '-',
    data.message   || '',
    ''
  ]);
}


// ── 축하 메시지 → 별도 시트에 기록 / 삭제 ──────────────
// 컬럼 순서: ID | 타임스탬프 | 성함 | 메시지
function handleComment(data) {
  const sheet  = SpreadsheetApp.openById(COMMENT_SHEET_ID).getSheets()[0];
  const HEADER = ['ID', '타임스탬프', '성함', '메시지'];

  // ── 삭제 요청 ──
  if (data.action === 'delete') {
    const values = sheet.getDataRange().getValues();
    for (let i = values.length - 1; i >= 1; i--) {
      if (values[i][0] === data.id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return;
  }

  // ── 등록 요청 ──
  ensureHeader(sheet, HEADER);

  sheet.appendRow([
    data.id,
    Utilities.formatDate(new Date(data.timestamp), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    data.name,
    data.message
  ]);
}

// ── 스냅 → Drive 폴더에 업로드 + 제출 명단 기록 ──────
// 파일명 규칙: 성함_HHmmss_N.ext  (예: 홍길동_143022_1.jpg)
// 컬럼 순서: 타임스탬프 | 성함 | 연락처 | 파일 수 | 저장 파일명
function handleSnap(data) {
  const sheet  = SpreadsheetApp.openById(SNAP_SHEET_ID).getSheets()[0];
  const HEADER = ['타임스탬프', '성함', '연락처', '파일 수', '저장 파일명'];

  ensureHeader(sheet, HEADER);

  const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const tag        = Utilities.formatDate(new Date(), 'Asia/Seoul', 'MMdd-HHmmss');
  const savedNames = [];
  let idx = 1;

  if (data.files && data.files.length) {
    data.files.forEach(function(f) {
      try {
        const ext      = f.ext || (f.mimeType && f.mimeType.startsWith('video/') ? 'mp4' : 'jpg');
        const fileName = data.name + '_' + tag + '_' + idx + '.' + ext;
        const bytes    = Utilities.base64Decode(f.base64);
        const blob     = Utilities.newBlob(bytes, f.mimeType, fileName);
        rootFolder.createFile(blob);
        savedNames.push(fileName);
        idx++;
      } catch (err) { /* 파일 하나 실패해도 계속 진행 */ }
    });
  }

  sheet.appendRow([
    Utilities.formatDate(new Date(data.timestamp), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    data.name,
    data.contact,
    savedNames.length,
    savedNames.join(' / ')
  ]);
}
