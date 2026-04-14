/**
 * ModalOverlayTemplateComponent
 * All modal/overlay blocks extracted from index.html.
 * Injected into <div id="modal-overlay-template-root"> at runtime.
 */

const MODAL_OVERLAY_TEMPLATE_HTML = `
  <!-- START TRIAGE OVERLAY -->
  <div id="start-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.98);z-index:500;flex-direction:column;">
    <div class="start-header"
      style="background:var(--red2);padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;">
      <div style="flex:1">
        <div style="font-size:10px;color:rgba(255,255,255,.7);letter-spacing:.1em">START TRIAGE — 30 שניות</div>
        <div style="font-size:16px;font-weight:900;color:#fff" id="start-cas-name">פגוע חדש</div>
      </div>
      <div style="font-family:var(--font-mono);font-size:52px;font-weight:700;color:var(--amber3);line-height:1;"
        id="start-timer">30</div>
      <button class="btn btn-ghost"
        style="font-size:12px;padding:0 8px;min-height:28px;border-color:rgba(255,255,255,.3);color:rgba(255,255,255,.6)"
        onclick="closeSTART()">✕</button>
    </div>
    <div
      style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:14px;overflow-y:auto;"
      id="start-body"></div>
  </div>

  <!-- Evac Queue Modal -->
  <div id="evac-modal"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:480;overflow-y:auto;">
    <div style="max-width:430px;margin:0 auto;padding:16px">
      <div style="display:flex;align-items:center;margin-bottom:12px;gap:10px">
        <div style="font-size:18px;font-weight:900;flex:1">🚁 תור פינוי — CASEVAC</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('evac-modal').style.display='none'">✕</button>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;align-items:center;flex-wrap:wrap">
        <div style="font-size:12px;color:var(--muted2)">הליקופטר בעוד:</div>
        <input class="inp" id="heli-eta-in" type="number" min="1" max="120" placeholder="דקות" style="width:70px"
          oninput="setHeliETA(this.value)">
        <input id="heli-eta-range" type="range" min="1" max="120" value="10" style="flex:1;" 
          oninput="setHeliETA(this.value)">
        <div id="heli-eta-val" style="font-size:12px;color:var(--muted2);min-width:fit-content">10 דקות</div>
        <div style="font-family:var(--font-mono);font-size:24px;font-weight:700;color:var(--amber3);"
          id="heli-countdown"></div>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn btn-sm btn-olive" onclick="autoAssignEvacSlots()">⚡ שיבוץ אוטומטי</button>
        <button class="btn btn-sm btn-ghost" onclick="renderEvacSlots();renderEvacPriority()">⟳ עדכון עדיפויות</button>
      </div>
      <div style="font-size:11px;color:var(--olive3);font-weight:700;margin:8px 0 6px">🚁 כוח מפנה + תדרים (מהכנה)</div>
      <div id="evac-war-snapshot-modal" style="margin-bottom:8px">
        <div style="font-size:11px;color:var(--muted);padding:8px 0">שמור נתוני פינוי בטאב הכנה → פינוי</div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:8px">לחץ על סלוט לשיוך / שחרור פגוע</div>
      <div id="evac-slots"></div>
      <button class="btn btn-md btn-olive btn-full" style="margin-top:8px" onclick="addEvacSlot()">＋ הוסף מקום</button>
      <div style="margin-top:12px">
        <div style="font-size:11px;color:var(--olive3);font-weight:700;margin-bottom:6px">ממתינים לשיוך:</div>
        <div id="evac-unassigned" style="display:flex;flex-direction:column;gap:4px"></div>
      </div>
    </div>
  </div>

  <!-- Resource Calculator Modal -->
  <div id="res-modal"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:480;overflow-y:auto;">
    <div style="max-width:430px;margin:0 auto;padding:16px">
      <div style="display:flex;align-items:center;margin-bottom:12px;gap:10px">
        <div style="font-size:18px;font-weight:900;flex:1">🔧 מחשבון משאבים</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('res-modal').style.display='none'">✕</button>
      </div>
      <div style="font-size:11px;color:var(--muted2);margin-bottom:10px;">יש מול נדרש — לפי פגועים פעילים</div>
      <div class="card" style="margin:0 0 10px">
        <div id="res-table"></div>
      </div>
      <div style="font-size:11px;color:var(--muted2);margin-bottom:6px;font-weight:700">עדכן מלאי:</div>
      <div id="res-supply-edit" style="display:grid;grid-template-columns:1fr 1fr;gap:6px"></div>
    </div>
  </div>

  <!-- Radio Templates Modal -->
  <div id="radio-modal"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:480;overflow-y:auto;">
    <div style="max-width:430px;margin:0 auto;padding:16px">
      <div style="display:flex;align-items:center;margin-bottom:12px;gap:10px">
        <div style="font-size:18px;font-weight:900;flex:1">📻 תבניות רדיו</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('radio-modal').style.display='none'">✕</button>
      </div>
      <div id="radio-templates-list"></div>
    </div>
  </div>

  <!-- Triage Tag Modal -->
  <div id="tag-modal"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:480;overflow-y:auto;">
    <div style="max-width:430px;margin:0 auto;padding:16px">
      <div style="display:flex;align-items:center;margin-bottom:12px;gap:10px">
        <div style="font-size:18px;font-weight:900;flex:1">🏷️ תגי טריאז' דיגיטליים</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('tag-modal').style.display='none'">✕</button>
      </div>
      <div style="font-size:11px;color:var(--muted2);margin-bottom:10px;">לחץ הדפס לייצוא תגים לנייר</div>
      <div id="tag-list"></div>
      <button class="btn btn-lg btn-ghost btn-full" style="margin-top:10px" onclick="window.print()">🖨️ הדפס
        תגים</button>
    </div>
  </div>

  <!-- Swipe Focus Mode -->
  <div id="swipe-overlay" class="overlay">
    <div style="height:100%;display:flex;flex-direction:column;padding:20px 10px">
      <div style="display:flex;justify-content:space-between;align-items:center;color:#fff;margin-bottom:12px">
        <div id="swipe-index" style="font-weight:900;font-size:16px">1/1</div>
        <div id="swipe-dots" style="display:flex;gap:4px"></div>
        <button class="btn btn-sm btn-ghost" onclick="closeSwipeMode()" style="color:#fff">✕</button>
      </div>
      <div id="swipe-body" style="flex:1;display:flex;align-items:center;justify-content:center"></div>
      <div style="display:flex;justify-content:space-between;gap:12px;margin-top:20px">
        <button class="btn btn-xl btn-ghost" style="flex:1;background:rgba(255,255,255,.1);color:#fff" onclick="swipeNav(-1)">PREV</button>
        <button class="btn btn-xl btn-ghost" style="flex:1;background:rgba(255,255,255,.1);color:#fff" onclick="swipeNav(1)">NEXT</button>
      </div>
    </div>
  </div>

  <!-- Mass Casualty Sort -->
  <div id="msort-overlay" class="overlay">
    <div class="modal" style="height:90vh;display:flex;flex-direction:column">
      <div class="modal-hdr"><div>🚀 Mass Casualty Sort</div><div class="modal-close" onclick="closeMassSort()">✕</div></div>
      <div class="modal-body col" style="flex:1;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--s2);padding:10px;border-radius:8px">
          <div id="msort-timer" style="font-family:monospace;font-size:24px;font-weight:900;color:var(--amber2)">0:00</div>
          <div id="msort-name" style="font-size:18px;font-weight:900">הזן שם ראשון</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
           <input class="inp" id="msort-name-in" placeholder="שם הפצוע" style="grid-column:span 2" onkeydown="if(event.key==='Enter')msortNext()">
           <input class="inp" id="msort-kg-in" type="number" placeholder='ק"ג 70'>
           <select class="inp" id="msort-blood-in"><option value="">דם?</option><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
          <button class="btn" style="height:100px;background:var(--red2);font-size:24px;flex-direction:column;gap:4px" onclick="msortAssign('T1')">T1 <small id="msc-t1" style="font-size:12px">0</small></button>
          <button class="btn" style="height:100px;background:var(--orange2);font-size:24px;flex-direction:column;gap:4px" onclick="msortAssign('T2')">T2 <small id="msc-t2" style="font-size:12px">0</small></button>
          <button class="btn" style="height:100px;background:var(--green2);font-size:24px;flex-direction:column;gap:4px" onclick="msortAssign('T3')">T3 <small id="msc-t3" style="font-size:12px">0</small></button>
          <button class="btn" style="height:100px;background:#444;font-size:24px;flex-direction:column;gap:4px" onclick="msortAssign('T4')">T4 <small id="msc-t4" style="font-size:12px">0</small></button>
        </div>
        <button class="btn btn-xl btn-ghost btn-full" style="margin-top:auto" onclick="closeMassSort()">סיום מיון</button>
      </div>
    </div>
  </div>

  <!-- Hospital Handoff -->
  <div id="hosp-overlay" class="overlay" style="background:var(--bg)">
    <div style="height:100%;overflow-y:auto;padding-bottom:100px">
      <div style="position:sticky;top:0;background:rgba(10,10,10,.8);backdrop-filter:blur(10px);padding:16px 10px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--b0);z-index:10">
        <button class="btn btn-sm btn-ghost" onclick="closeHospHandoff()">✕</button>
        <div style="font-size:18px;font-weight:900" id="hosp-cas-name">Name</div>
        <div style="margin-left:auto;font-size:11px;background:var(--red3);padding:2px 8px;border-radius:20px;font-weight:900">HOSPITAL HANDOFF</div>
      </div>
      <div id="hosp-body" class="pad col" style="gap:4px"></div>
    </div>
  </div>

  <!-- CLOSING PROTOCOL -->
  <div id="closing-overlay">
    <div class="cl-header">
      <div style="flex:1">
        <div style="font-size:10px;color:var(--green3);letter-spacing:.1em;font-weight:700">CLOSING PROTOCOL</div>
        <div style="font-size:16px;font-weight:900;color:#fff">סגירת אירוע — שלב אחר שלב</div>
      </div>
      <div style="font-family:var(--font-mono);font-size:22px;color:var(--olive3)" id="cl-done-count">0/0</div>
      <button class="btn btn-ghost"
        style="font-size:12px;padding:0 8px;min-height:28px;border-color:rgba(255,255,255,.2)"
        onclick="document.getElementById('closing-overlay').classList.remove('on')">✕</button>
    </div>
    <div class="cl-body" id="cl-body"></div>
  </div>

  <!-- FORM 101 VIEWER -->
  <div id="f101-overlay" class="overlay" style="background:#fff;z-index:2000">
    <div style="height:100%;overflow-y:auto;color:#000">
      <div style="position:sticky;top:0;background:#f5f5f5;padding:12px;display:flex;align-items:center;gap:12px;border-bottom:2px solid #000;z-index:100">
        <button class="btn btn-md btn-ghost" style="color:#000;border-color:#000" onclick="$('f101-overlay').style.display='none'">✕ סגור</button>
        <div style="font-weight:900;flex:1">טופס 101 דיגיטלי</div>
        <button class="btn btn-md btn-olive" onclick="print101()">🖨️ הדפס</button>
      </div>
      <div style="background:#ddd;padding:8px;display:flex;gap:6px;overflow-x:auto" id="f101-pick"></div>
      <div id="f101-content"></div>
    </div>
  </div>

  <!-- REFERENCE LIBRARY -->
  <div id="ref-library-overlay" class="overlay"
    style="position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:480;overflow-y:auto;display:none">
    <div style="max-width:480px;margin:0 auto;padding:12px">
      <div style="display:flex;align-items:center;margin-bottom:10px;gap:8px">
        <div style="font-size:16px;font-weight:900;flex:1;color:#fff">📚 Reference Library</div>
        <button class="btn btn-ghost btn-sm" onclick="closeReferenceLibrary()">✕</button>
      </div>
      <input class="inp" placeholder="🔍 Search..." oninput="renderReferenceLibrary(this.value)"
        style="margin-bottom:10px;width:100%">
      <div id="ref-library-body"></div>
    </div>
  </div>

  <!-- PERFORMANCE ANALYTICS -->
  <div id="perf-overlay" class="overlay">
    <div class="modal" style="height:85vh;display:flex;flex-direction:column">
      <div class="modal-hdr"><div>📈 ניתוח ביצועים — AAR</div><div class="modal-close" onclick="$('perf-overlay').style.display='none'">✕</div></div>
      <div class="modal-body col" style="flex:1;overflow-y:auto" id="perf-body"></div>
      <div class="pad"><button class="btn btn-lg btn-ghost btn-full" onclick="$('perf-overlay').style.display='none'">סגור</button></div>
    </div>
  </div>

  <!-- SMART CHECKLIST -->
  <div id="scl-overlay">
    <div style="max-width:430px;margin:0 auto;padding:16px">
      <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
        <div style="font-size:18px;font-weight:900;flex:1">✅ Checklist חכם</div>
        <div style="font-size:11px;color:var(--muted2)" id="scl-progress-lbl"></div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('scl-overlay').classList.remove('on')">✕</button>
      </div>
      <div id="scl-filter" style="display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap"></div>
      <div id="scl-body"></div>
    </div>
  </div>

  <!-- AI OFFLINE TRIAGE -->
  <div id="ai-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:480;overflow-y:auto;">
    <div style="max-width:430px;margin:0 auto;padding:16px">
      <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
        <div style="font-size:18px;font-weight:900;flex:1">🤖 AI טריאז' — Offline</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ai-overlay').style.display='none'">✕</button>
      </div>
      <div style="font-size:11px;color:var(--muted2);margin-bottom:10px">הכנס ויטלים → קבל המלצה מלאה ללא אינטרנט</div>
      <div class="card" style="margin-bottom:10px">
        <div class="pad col">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div>
              <div style="font-size:9px;color:var(--muted2);margin-bottom:3px">דופק</div><input class="inp"
                id="ait-pulse" type="number" placeholder="72" style="text-align:center">
            </div>
            <div>
              <div style="font-size:9px;color:var(--muted2);margin-bottom:3px">SpO2%</div><input class="inp"
                id="ait-spo2" type="number" placeholder="98" style="text-align:center">
            </div>
            <div>
              <div style="font-size:9px;color:var(--muted2);margin-bottom:3px">GCS</div><input class="inp" id="ait-gcs"
                type="number" placeholder="15" min="3" max="15" style="text-align:center">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <div style="font-size:9px;color:var(--muted2);margin-bottom:3px">לחץ דם SBP</div><input class="inp"
                id="ait-sbp" type="number" placeholder="120" style="text-align:center">
            </div>
            <div>
              <div style="font-size:9px;color:var(--muted2);margin-bottom:3px">נשימות/דקה</div><input class="inp"
                id="ait-rr" type="number" placeholder="16" style="text-align:center">
            </div>
          </div>
          <div style="font-size:10px;color:var(--muted2);margin-top:4px">מנגנון פציעה:</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px" id="ait-mech-btns">
            <button class="btn btn-xs btn-ghost" onclick="togAITMech(this,'ירי')">ירי</button>
            <button class="btn btn-xs btn-ghost" onclick="togAITMech(this,'פיצוץ')">פיצוץ</button>
            <button class="btn btn-xs btn-ghost" onclick="togAITMech(this,'TBI')">TBI</button>
            <button class="btn btn-xs btn-ghost" onclick="togAITMech(this,'חזה')">חזה</button>
            <button class="btn btn-xs btn-ghost" onclick="togAITMech(this,'בטן')">בטן</button>
            <button class="btn btn-xs btn-ghost" onclick="togAITMech(this,'כוויה')">כוויה</button>
            <button class="btn btn-xs btn-ghost" onclick="togAITMech(this,'אחר')">אחר</button>
          </div>
          <button class="btn btn-xl btn-olive btn-full" onclick="runOfflineAI()">🤖 חשב המלצה</button>
        </div>
      </div>
      <div id="ai-result"></div>
    </div>
  </div>

  <!-- MEDICATION INTERACTIONS -->
  <div id="medint-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:480;overflow-y:auto;">
    <div style="max-width:430px;margin:0 auto;padding:16px">
      <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px">
        <div style="font-size:18px;font-weight:900;flex:1">💊 אינטראקציות תרופות</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('medint-overlay').style.display='none'">✕</button>
      </div>
      <div id="medint-pick" style="margin-bottom:10px"></div>
      <div id="medint-result"></div>
    </div>
  </div>

  <!-- TRAINING MODE -->
  <div id="train-overlay" style="display:none;position:fixed;inset:0;background:#020010;z-index:480;overflow-y:auto;">
    <div style="max-width:430px;margin:0 auto;padding:16px">
      <div style="display:flex;align-items:center;margin-bottom:14px;gap:8px">
        <div style="font-size:18px;font-weight:900;flex:1;color:#c0a0ff">🎓 Training Mode</div>
        <button class="btn btn-ghost btn-sm" style="border-color:#6040d0;color:#a080ff"
          onclick="document.getElementById('train-overlay').style.display='none'">✕</button>
      </div>
      <div id="train-body"></div>
    </div>
  </div>

  <!-- QR SCAN OVERLAY -->
  <div class="overlay" id="qr-scan-overlay">
    <div class="qr-scan-container">
      <video id="qr-scan-video" playsinline></video>
      <div class="qr-scan-guide">
        <div class="qr-scan-corner tl"></div><div class="qr-scan-corner tr"></div>
        <div class="qr-scan-corner bl"></div><div class="qr-scan-corner br"></div>
      </div>
      <div class="qr-scan-header">
        <button class="btn btn-sm btn-ghost" onclick="stopQRScan()" style="color:#fff">✕</button>
        <div style="flex:1;text-align:center;font-weight:900;text-shadow:0 2px 4px rgba(0,0,0,1)">📷 סרוק QR</div>
        <button class="btn btn-sm btn-ghost" id="torch-btn" onclick="toggleTorch()" style="display:none">🔦</button>
      </div>
      <div id="qr-scan-status" class="qr-scan-status">מחפש QR...</div>
      <div id="qr-scan-info" class="qr-scan-info"></div>
      <div class="qr-scan-controls">
        <button class="btn btn-sm btn-ghost" onclick="triggerQRImageScan()" style="background:rgba(0,0,0,.6);color:#fff">🖼 תמונה</button>
        <button class="btn btn-sm btn-ghost" onclick="toggleQRPasteArea()" style="background:rgba(0,0,0,.6);color:#fff">📋 הדבק</button>
      </div>
      <input type="file" id="qr-scan-file" accept="image/*" style="display:none" onchange="onQRImageSelected(event)">
      <div id="qr-scan-paste-area" style="display:none;position:absolute;bottom:80px;left:10px;right:10px;background:rgba(20,20,20,.95);padding:10px;border-radius:10px;border:1px solid #444;z-index:100">
         <textarea id="qr-scan-paste" class="other-note show" rows="4" placeholder="הדבק JSON כאן..."></textarea>
         <button class="btn btn-md btn-amber btn-full" onclick="importPastedQR()">טען מהדבקה</button>
      </div>
    </div>
  </div>

  <!-- QR EXPORT OVERLAY -->
  <div class="overlay" id="qr-export-overlay">
    <div class="modal" style="max-height:92vh">
      <div class="modal-hdr"><div>📤 QR Sync — ייצוא מצב</div><div class="modal-close" onclick="closeQRExport()">✕</div></div>
      <div class="modal-body col" style="padding:16px;align-items:center;text-align:center">
        <div id="qr-export-code" style="background:#fff;padding:12px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.3)"></div>
        <div id="qr-export-info" style="font-size:11px;color:var(--muted);margin-top:12px"></div>
        <div style="display:flex;gap:8px;width:100%;margin-top:12px">
          <button class="btn btn-md btn-ghost btn-full" onclick="copyExportJSON()">📋 העתק JSON</button>
          <button class="btn btn-md btn-ghost btn-full" onclick="shareStateViaWebShare()">🔗 שתף</button>
        </div>
        <button class="btn btn-lg btn-olive btn-full" style="margin-top:8px" onclick="closeQRExport()">סיום</button>
      </div>
    </div>
  </div>

  <!-- SA Pulse float button -->
  <div id="sa-pulse" onclick="openSAPulse()">⚠ אשר מצב</div>

  <!-- Training bar -->
  <div id="training-bar">🎓 TRAINING MODE — נתונים אלו אינם אמיתיים</div>

  <!-- TACTICAL MAP -->
  <div id="tmap-overlay">
    <div class="tmap-header">
      <div style="flex:1">
        <div style="font-size:10px;color:var(--olive3);letter-spacing:.1em;font-weight:700">TACTICAL MAP</div>
        <div style="font-size:15px;font-weight:900;color:#fff" id="tmap-title">מפת אירוע</div>
      </div>
      <div class="tmap-controls">
        <button class="btn btn-xs btn-ghost" onclick="tmapAddLZ()">+ LZ</button>
        <button class="btn btn-xs btn-ghost" onclick="tmapClearOverride()">איפוס מיקום</button>
        <button class="btn btn-xs btn-ghost" onclick="tmapToggleGrid()">רשת</button>
      </div>
      <button class="btn btn-ghost" style="font-size:12px;padding:0 10px;min-height:30px"
        onclick="document.getElementById('tmap-overlay').classList.remove('on')">✕</button>
    </div>
    <svg id="tmap-svg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet">
      <g id="tmap-grid" opacity="0.15">
        <line x1="100" y1="0" x2="100" y2="500" stroke="#4a6640" stroke-width="0.5" />
        <line x1="200" y1="0" x2="200" y2="500" stroke="#4a6640" stroke-width="0.5" />
        <line x1="300" y1="0" x2="300" y2="500" stroke="#4a6640" stroke-width="0.5" />
        <line x1="0" y1="125" x2="400" y2="125" stroke="#4a6640" stroke-width="0.5" />
        <line x1="0" y1="250" x2="400" y2="250" stroke="#4a6640" stroke-width="0.5" />
        <line x1="0" y1="375" x2="400" y2="375" stroke="#4a6640" stroke-width="0.5" />
      </g>
      <g transform="translate(360,40)">
        <circle r="18" fill="#0a1a0c" stroke="#4a6640" stroke-width="1" />
        <text x="0" y="-6" text-anchor="middle" fill="#7aaa65" font-size="8" font-weight="700">N</text>
        <polygon points="0,-12 3,-3 0,0 -3,-3" fill="#f04848" />
        <polygon points="0,12 3,3 0,0 -3,3" fill="#555" />
      </g>
      <g id="tmap-cas-layer"></g>
      <g id="tmap-lz-layer"></g>
      <g id="tmap-path-layer"></g>
    </svg>
    <div class="tmap-legend">
      <div class="tmap-leg-item"><svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="#c82828" /></svg> T1</div>
      <div class="tmap-leg-item"><svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="#c89010" /></svg> T2</div>
      <div class="tmap-leg-item"><svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="#28822a" /></svg> T3</div>
      <div class="tmap-leg-item"><svg width="12" height="12"><rect width="12" height="12" fill="#186018" /></svg> LZ</div>
      <div class="tmap-leg-item" style="margin-right:auto"><svg width="12" height="12"><polygon points="6,0 12,12 0,12" fill="#c89010" /></svg> חובש</div>
      <button class="btn btn-xs btn-olive" onclick="tmapAutoLayout()">🔄 סדר אוטומטי</button>
      <button class="btn btn-xs btn-ghost" onclick="openTacticalMap()">🔄 רענן</button>
    </div>
  </div>

  <!-- MESH SYNC -->
  <div id="mesh-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,8,.97);z-index:490;overflow-y:auto;">
    <div style="max-width:430px;margin:0 auto;padding:16px">
      <div style="display:flex;align-items:center;margin-bottom:14px;gap:10px">
        <div style="font-size:18px;font-weight:900;flex:1;color:#88aaff">🔗 Mesh Sync</div>
        <div class="mesh-pulse" id="mesh-status">
          <div class="mesh-dot"></div>מוכן
        </div>
        <button class="btn btn-ghost btn-sm" style="border-color:#2844aa"
          onclick="document.getElementById('mesh-overlay').style.display='none'">✕</button>
      </div>
      <div style="font-size:11px;color:#6688cc;margin-bottom:14px;line-height:1.7">
        סרוק QR של חובש אחר ← המערכת ממזגת עדכונים חכם (timestamp-based). אין Wi-Fi נדרש.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <button class="btn btn-lg btn-ghost btn-full"
          style="border-color:#2844aa;color:#88aaff;flex-direction:column;gap:4px;padding:12px" onclick="meshExport()">
          <div style="font-size:22px">📤</div>
          <div style="font-size:12px;font-weight:700">שלח עדכון</div>
          <div style="font-size:9px;color:#4466aa">יצור QR / JSON</div>
        </button>
        <button class="btn btn-lg btn-ghost btn-full"
          style="border-color:#2844aa;color:#88aaff;flex-direction:column;gap:4px;padding:12px" onclick="meshScanQR()">
          <div style="font-size:22px">📥</div>
          <div style="font-size:12px;font-weight:700">קבל עדכון</div>
          <div style="font-size:9px;color:#4466aa">סרוק QR / הדבק JSON</div>
        </button>
      </div>
      <div id="mesh-export-area" style="display:none;margin-bottom:12px"></div>
      <div id="mesh-import-area" style="display:none;margin-bottom:12px">
        <textarea class="other-note show" id="mesh-import-txt" rows="4" placeholder="הדבק JSON של עדכון כאן..."
          style="font-family:monospace;font-size:10px"></textarea>
        <button class="btn btn-md btn-olive btn-full" onclick="meshApplyImport()" style="margin-top:6px">✓ מזג
          עדכון</button>
      </div>
      <div id="mesh-log" style="font-size:10px;color:#4466aa;line-height:1.8;font-family:monospace"></div>
      <div class="sec" style="margin-top:12px">מצב סנכרון</div>
      <div id="mesh-sync-status" style="font-size:11px;color:#6688cc;padding:6px 0"></div>
    </div>
  </div>

  <!-- ALLERGY BLOCK -->
  <div id="allergy-block" class="overlay" style="background:rgba(150,0,0,.92);z-index:9000">
    <div class="pad col" style="height:100%;align-items:center;justify-content:center;text-align:center;color:#fff;gap:20px">
      <div style="font-size:80px">⛔</div>
      <div style="font-size:32px;font-weight:900">סכנת חיים: אלרגיה!</div>
      <div id="ab-detail" style="font-size:20px;line-height:1.6">פניצילין — אין לתת!</div>
      <button class="btn btn-xl btn-full" style="background:#fff;color:#c00;border:none" onclick="$('allergy-block').classList.remove('on');$('allergy-block').style.display='none'">הבנתי, מחליף טיפול</button>
    </div>
  </div>

  <!-- Guided Flow -->
  <div id="guided-overlay">
    <div class="guided-top">
      <div style="flex:1">
        <div class="guided-step-num" id="gf-step-label">שלב 1 מתוך 5</div>
        <div class="guided-step-title" id="gf-title">—</div>
      </div>
      <div class="guided-skip" onclick="closeGuided()">דלג ✕</div>
    </div>
    <div class="guided-body">
      <div class="guided-instruction" id="gf-instruction">—</div>
      <div class="guided-sub" id="gf-sub">—</div>
      <button class="guided-confirm" id="gf-confirm-btn" onclick="guidedNext()">✓ בוצע — המשך</button>
      <div class="guided-progress" id="gf-progress"></div>
    </div>
  </div>

  <!-- Hand-Off -->
  <div id="handoff-screen">
    <button class="btn btn-ghost" style="position:absolute;top:16px;left:16px;font-size:14px"
      onclick="document.getElementById('handoff-screen').classList.remove('on')">✕ סגור</button>
    <div class="ho-name" id="ho-name"></div>
    <div class="ho-blood" id="ho-blood"></div>
    <div class="ho-allergy" id="ho-allergy" style="display:none"></div>
    <div class="ho-tx" id="ho-tx"></div>
    <div class="ho-tq" id="ho-tq" style="display:none"></div>
  </div>

  <!-- Reassess Toast -->
  <div id="reassess-toast"></div>

  <!-- GLOBAL INJURY POPUP (body map) -->
  <div id="inj-popup-global" class="inj-popup" style="display:none">
    <div id="inj-popup-zone" style="font-size:10px;color:var(--muted);margin-bottom:6px">בחר סוג פציעה</div>
    <div id="inj-popup-btns" style="display:grid;grid-template-columns:1fr 1fr;gap:6px"></div>
    <textarea id="inj-popup-note" class="other-note" style="margin-top:8px" placeholder="פרט..."></textarea>
    <div style="display:flex;gap:6px;margin-top:8px">
      <button class="btn btn-sm btn-olive btn-full" onclick="confirmInjury()">שמור</button>
      <button class="btn btn-sm btn-ghost" onclick="cancelInjury()">ביטול</button>
    </div>
  </div>

  <!-- Voice status (accessible via voice commands only) -->
  <div id="voice-status" style="display:none"></div>

  <!-- Worsening Alert -->
  <div id="worsening-alert"></div>

  <!-- Decision Tree -->
  <div id="dtree-overlay">
    <div class="dt-header">
      <div style="flex:1">
        <div style="font-size:11px;color:rgba(255,255,255,.7);letter-spacing:.1em" id="dt-phase-label">MARCH — M</div>
        <div style="font-size:17px;font-weight:900;color:#fff" id="dt-cas-label">—</div>
      </div>
      <div class="dt-breadcrumb" id="dt-breadcrumb"></div>
      <button class="btn btn-ghost"
        style="font-size:12px;padding:0 10px;min-height:28px;border-color:rgba(255,255,255,.3);color:rgba(255,255,255,.6)"
        onclick="closeDTree()">✕</button>
    </div>
    <div class="dt-body" id="dt-body"></div>
  </div>

  <!-- GLOBAL MODAL (The bread and butter) -->
  <div class="overlay" id="overlay" onclick="closeModalOutside(event)">
    <div class="modal">
      <div class="modal-hdr">
        <div id="modal-title">כותרת</div>
        <div class="modal-close" onclick="closeModal()">✕</div>
      </div>
      <div class="modal-body" id="modal-body"></div>
    </div>
  </div>
`;

export function mountModalOverlayTemplateRoot() {
  const root = document.getElementById('modal-overlay-template-root');
  if (!root) {
    console.warn('[BENAM] modal-overlay-template-root not found — skipping modal overlay mount');
    return;
  }
  root.innerHTML = MODAL_OVERLAY_TEMPLATE_HTML;
}

export function initModalOverlayTemplateComponent() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountModalOverlayTemplateRoot);
  } else {
    mountModalOverlayTemplateRoot();
  }
}
