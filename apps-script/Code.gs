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
const RSVP_SHEET_ID   = '1jcLL_HM00aGnfyOL1FxdXTy31dae5ezOxqxEg3FV7_U'; // 본식 RSVP
const SNAP_SHEET_ID   = '1JpCAUW23zn1a_ZNiJrENMMtrHIhmt9tepHxJRc9jhAY'; // 스냅 제출 명단
const DRIVE_FOLDER_ID = '1pkuh2kDPZWCKxT62I_i5EXuzyURt4k3g';              // 하객 스냅 사진 폴더
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
    const header = ['타임스탬프', '성함', '연락처', '참석여부', '인원수', '메시지'];
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground('#F7F4EE');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    Utilities.formatDate(new Date(data.timestamp), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    data.name,
    data.contact,
    data.attending === 'yes' ? '✓ 참석' : '✕ 불참',
    data.partySize || '-',
    data.message   || ''
  ]);
}

// ── 스냅 → Drive 업로드 + 스냅 제출 명단 시트 기록 ──
function handleSnap(data) {
  const ss = SpreadsheetApp.openById(SNAP_SHEET_ID);
  let sheet = ss.getSheets()[0]; // 첫 번째 시트 사용

  // 헤더가 없으면 추가
  if (sheet.getLastRow() === 0) {
    const header = ['타임스탬프', '성함', '연락처', '파일 수', 'Drive 폴더 링크'];
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground('#F7F4EE');
    sheet.setFrozenRows(1);
  }

  // 하객 이름_날짜 서브폴더 생성 (예: 홍길동_0905)
  const rootFolder  = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const dateStr     = Utilities.formatDate(new Date(), 'Asia/Seoul', 'MMdd');
  const guestFolder = rootFolder.createFolder(data.name + '_' + dateStr);

  // 파일 저장 — 파일명: 성함_1.jpg, 성함_2.mp4 …
  let savedCount = 0;
  if (data.files && data.files.length) {
    data.files.forEach(function(f) {
      try {
        const bytes = Utilities.base64Decode(f.base64);
        const blob  = Utilities.newBlob(bytes, f.mimeType, f.savedName);
        guestFolder.createFile(blob);
        savedCount++;
      } catch(err) { /* 파일 하나 실패해도 계속 진행 */ }
    });
  }

  sheet.appendRow([
    Utilities.formatDate(new Date(data.timestamp), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    data.name,
    data.contact,
    savedCount,
    guestFolder.getUrl()
  ]);
}
