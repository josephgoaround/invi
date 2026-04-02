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
 */

// ── 설정값 ────────────────────────────────────────────
const RSVP_SHEET_ID    = '1jcLL_HM00aGnfyOL1FxdXTy31dae5ezOxqxEg3FV7_U'; // 본식 RSVP
const COMMENT_SHEET_ID = '1jTZjlu9QQq69lSIV9TcgAU9q2yTUghnT3liXW9NS0LE'; // 축하 메시지
const SNAP_SHEET_ID    = '1JpCAUW23zn1a_ZNiJrENMMtrHIhmt9tepHxJRc9jhAY'; // 스냅 제출 명단
const DRIVE_FOLDER_ID  = '1pkuh2kDPZWCKxT62I_i5EXuzyURt4k3g';             // 하객 스냅 사진 폴더
// ─────────────────────────────────────────────────────

function doGet() {
  return ContentService
    .createTextOutput('Wedding API is running ✦')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.type === 'rsvp') {
      handleRsvp(data);
    } else if (data.type === 'snap') {
      handleSnap(data);
    } else if (data.type === 'comment') {
      handleComment(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── RSVP → 본식 RSVP 시트 기록 ──────────────────────
function handleRsvp(data) {
  const ss = SpreadsheetApp.openById(RSVP_SHEET_ID);
  let sheet = ss.getSheets()[0]; // 첫 번째 시트 사용

  // 헤더가 없으면 추가
  if (sheet.getLastRow() === 0) {
    const header = ['타임스탬프', '성함', '관계', '연락처', '참석여부', '인원수', '메시지'];
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground('#F7F4EE');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    Utilities.formatDate(new Date(data.timestamp), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    data.name,
    data.relation  || '',
    data.contact,
    data.attending === 'yes' ? '✓ 참석' : '✕ 불참',
    data.partySize || '-',
    data.message   || ''
  ]);
}

// ── 축하 메시지 → 별도 시트에 기록 / 삭제 ──────────────
function handleComment(data) {
  const ss    = SpreadsheetApp.openById(COMMENT_SHEET_ID);
  let   sheet = ss.getSheets()[0]; // 첫 번째 시트 사용

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
  if (sheet.getLastRow() === 0) {
    const header = ['ID', '타임스탬프', '성함', '메시지'];
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground('#F7F4EE');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    data.id,
    Utilities.formatDate(new Date(data.timestamp), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    data.name,
    data.message
  ]);
}

// ── 스냅 → Drive 루트 폴더에 직접 업로드 + 제출 명단 기록 ──
// 파일명 규칙: 성함_MMDD-HHmm_N.ext  (예: 홍길동_0905-1230_1.jpg)
function handleSnap(data) {
  const ss = SpreadsheetApp.openById(SNAP_SHEET_ID);
  let sheet = ss.getSheets()[0];

  if (sheet.getLastRow() === 0) {
    const header = ['타임스탬프', '성함', '연락처', '파일 수', '저장 파일명'];
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground('#F7F4EE');
    sheet.setFrozenRows(1);
  }

  const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const savedNames = [];

  if (data.files && data.files.length) {
    data.files.forEach(function(f) {
      try {
        const bytes = Utilities.base64Decode(f.base64);
        const blob  = Utilities.newBlob(bytes, f.mimeType, f.savedName);
        rootFolder.createFile(blob);
        savedNames.push(f.savedName);
      } catch(err) { /* 파일 하나 실패해도 계속 진행 */ }
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
